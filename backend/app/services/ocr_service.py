import os
import io
import re
import datetime
from typing import Dict, Any, Tuple
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from app.config import settings

class OCRService:
    def __init__(self):
        self.tesseract_available = False
        self._init_tesseract()

    def _init_tesseract(self):
        """Checks if pytesseract and tesseract binary are available."""
        try:
            import pytesseract
            import shutil

            tess_cmd = settings.TESSERACT_CMD
            if not tess_cmd:
                tess_cmd = shutil.which("tesseract") or shutil.which("tesseract.exe")

            # Check common Windows paths as fallback
            if not tess_cmd:
                for p in [
                    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                ]:
                    if os.path.exists(p):
                        tess_cmd = p
                        break

            if tess_cmd and os.path.exists(tess_cmd):
                pytesseract.pytesseract.tesseract_cmd = tess_cmd
                # Simple probe
                test_img = Image.new("RGB", (60, 30), color=(255, 255, 255))
                pytesseract.image_to_string(test_img)
                self.tesseract_available = True
            else:
                self.tesseract_available = False
        except Exception:
            self.tesseract_available = False

    def preprocess_image(
        self,
        image_path: str,
        rotate_deg: int = 0,
        enhance_contrast: bool = True,
        denoise: bool = True
    ) -> str:
        """
        Preprocesses an image for OCR:
        - Optional rotation
        - Grayscale conversion
        - Auto-contrast / Contrast enhancement
        - Median filter noise reduction
        Saves preprocessed image to a temporary file and returns path.
        """
        img = Image.open(image_path)
        
        # 1. Orientation / Rotation
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if rotate_deg != 0:
            img = img.rotate(rotate_deg, expand=True)

        # 2. Convert to Grayscale
        gray = img.convert("L")

        # 3. Contrast Enhancement
        if enhance_contrast:
            gray = ImageOps.autocontrast(gray, cutoff=2)
            enhancer = ImageEnhance.Contrast(gray)
            gray = enhancer.enhance(1.8)

        # 4. Denoise
        if denoise:
            gray = gray.filter(ImageFilter.MedianFilter(size=3))

        # Save preprocessed version
        base, ext = os.path.splitext(image_path)
        preprocessed_path = f"{base}_preprocessed.png"
        gray.save(preprocessed_path, format="PNG")
        return preprocessed_path

    def extract_text(
        self,
        image_path: str,
        rotate_deg: int = 0,
        enhance_contrast: bool = True,
        denoise: bool = True
    ) -> Dict[str, Any]:
        """
        Extracts visible text using Tesseract when available.
        When unavailable, returns explicit unconfigured status without returning
        fake sample data or fabricated confidence scores.
        """
        import logging
        logger = logging.getLogger("chronorx.ocr")
        logger.info(f"OCR request received: image={os.path.basename(image_path)}, rotate={rotate_deg}, contrast={enhance_contrast}, denoise={denoise}")

        preprocessed_path = self.preprocess_image(
            image_path,
            rotate_deg=rotate_deg,
            enhance_contrast=enhance_contrast,
            denoise=denoise
        )
        logger.info(f"Image preprocessing completed: saved to {preprocessed_path}")
        
        raw_text = ""
        engine = "not_configured"
        confidence = None
        error_message = None

        # Re-check availability in case configured at runtime
        if not self.tesseract_available:
            self._init_tesseract()

        if self.tesseract_available:
            try:
                import pytesseract
                img = Image.open(preprocessed_path)
                data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
                extracted = pytesseract.image_to_string(img)
                raw_text = self._clean_ocr_text(extracted)
                
                # If preprocessed image yielded no text, fallback to direct extraction on original image
                if not raw_text.strip():
                    orig_img = Image.open(image_path)
                    orig_extracted = pytesseract.image_to_string(orig_img)
                    orig_cleaned = self._clean_ocr_text(orig_extracted)
                    if orig_cleaned.strip():
                        raw_text = orig_cleaned
                        data = pytesseract.image_to_data(orig_img, output_type=pytesseract.Output.DICT)
                
                # Calculate mean confidence only from valid recognized words
                confs = [int(c) for c in data.get("conf", []) if str(c).isdigit() and int(c) > 0]
                if confs:
                    confidence = round(sum(confs) / (len(confs) * 100), 2)
                else:
                    confidence = None

                engine = "tesseract_ocr"
                logger.info(f"Tesseract OCR completed: extracted {len(raw_text)} chars with confidence {confidence}")
            except Exception as e:
                logger.warning(f"Tesseract OCR execution error: {e}")
                raw_text = ""
                confidence = None
                engine = "tesseract_error"
                error_message = f"OCR engine execution error: {str(e)}"
        else:
            logger.info("Tesseract binary not configured; returning no-text state without fake data.")
            raw_text = ""
            confidence = None
            engine = "not_configured"
            error_message = "Tesseract OCR binary is not configured or installed. Set TESSERACT_CMD in your .env or install Tesseract OCR on the system."

        return {
            "raw_text": raw_text,
            "confidence_score": confidence,
            "engine": engine,
            "error_message": error_message,
            "preprocessed_image_path": preprocessed_path,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }

    def _clean_ocr_text(self, text: str) -> str:
        """Removes stray OCR artifacts while preserving prescription structure."""
        if not text:
            return ""
        lines = [line.strip() for line in text.splitlines()]
        # Remove consecutive blank lines
        cleaned_lines = []
        for line in lines:
            if line:
                cleaned_lines.append(line)
            elif cleaned_lines and cleaned_lines[-1] != "":
                cleaned_lines.append("")
        return "\n".join(cleaned_lines)

ocr_service = OCRService()

