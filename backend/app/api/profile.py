import io
import os
import re
import uuid
from typing import Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from PIL import Image, UnidentifiedImageError
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.models import User
from app.schemas.schemas import ProfileResponse
from app.security.anonymizer import log_audit_event
from app.security.auth_handler import get_current_user

router = APIRouter(prefix="/profile", tags=["User Profile & Avatar"])

MAX_PROFILE_PHOTO_MB = 5
MAX_PROFILE_PHOTO_BYTES = MAX_PROFILE_PHOTO_MB * 1024 * 1024
MAX_IMAGE_DIMENSION = 8000

ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
ALLOWED_MIME_TYPES = {"image/jpeg", "image/jpg", "image/png", "image/webp"}
ALLOWED_PIL_FORMATS = {
    "JPEG": ".jpg",
    "PNG": ".png",
    "WEBP": ".webp",
}

ROLE_LABELS = {
    "doctor": "Doctor / Clinician",
    "receptionist": "Receptionist / Intake",
    "patient": "Patient",
    "admin": "Admin",
}

HONORIFIC_TOKENS = {
    "dr", "dr.", "prof", "prof.", "mr", "mr.", "mrs", "mrs.", "ms", "ms.",
    "md", "m.d.", "phd", "ph.d.", "do", "d.o.", "rn", "r.n."
}


def compute_user_initials(full_name: str) -> str:
    """
    Generates 2-letter professional initials from a user's full name,
    stripping medical titles/honorifics (e.g. 'Dr. Sarah Jenkins, M.D.' -> 'SJ').
    """
    if not full_name or not full_name.strip():
        return "U"
    # Remove parenthetical notes like (Demo) and comma suffixes like , M.D.
    cleaned = re.sub(r"\([^)]*\)", " ", full_name)
    cleaned = cleaned.split(",")[0].strip()
    tokens = [
        t.strip(".,- ")
        for t in cleaned.split()
        if t.strip(".,- ") and t.lower().strip(",") not in HONORIFIC_TOKENS
    ]
    if not tokens:
        tokens = [t.strip(".,- ") for t in full_name.split() if t.strip(".,- ")]
    if not tokens:
        return "U"
    if len(tokens) == 1:
        return tokens[0][:2].upper()
    return f"{tokens[0][0]}{tokens[1][0]}".upper()


def get_profile_upload_dir() -> str:
    profile_dir = os.path.join(settings.UPLOAD_DIR, "profiles")
    os.makedirs(profile_dir, exist_ok=True)
    return profile_dir


def build_profile_response(user: User) -> ProfileResponse:
    role_norm = (user.role or "doctor").lower()
    photo_url = user.profile_photo if user.profile_photo else None
    return ProfileResponse(
        name=user.full_name,
        full_name=user.full_name,
        role=role_norm,
        role_label=ROLE_LABELS.get(role_norm, role_norm.capitalize()),
        system_id=user.user_id,
        user_id=user.user_id,
        patient_id=user.patient_id,
        profile_photo=photo_url,
        has_photo=bool(photo_url),
        default_avatar=not bool(photo_url),
        initials=compute_user_initials(user.full_name),
    )


def _enforce_self_authorization(current_user: User, requested_user_id: Optional[str]) -> None:
    if requested_user_id is not None and requested_user_id.strip():
        target = requested_user_id.strip()
        if target.lower() != "me" and target.upper() != current_user.user_id.upper():
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Users cannot view or modify another user's profile or profile photo.",
            )


def _verify_magic_bytes(data: bytes) -> Optional[str]:
    """
    Checks binary file signature (magic bytes) to ensure content is genuinely JPG, PNG, or WEBP.
    """
    if len(data) < 12:
        return None
    if data[:3] == b"\xff\xd8\xff":
        return "JPEG"
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        return "PNG"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return "WEBP"
    return None


def _safe_remove_old_photo(user_id: str, photo_url: Optional[str]) -> None:
    """
    Safely removes an existing profile photo from disk only if it resides inside
    the managed profiles directory and belongs to the authenticated user.
    """
    if not photo_url:
        return
    try:
        filename = os.path.basename(photo_url)
        safe_uid = re.sub(r"[^A-Za-z0-9_-]", "", user_id)
        if not filename.startswith(f"profile_{safe_uid}_"):
            return
        profile_dir = os.path.abspath(get_profile_upload_dir())
        candidate_path = os.path.abspath(os.path.join(profile_dir, filename))
        if candidate_path.startswith(profile_dir + os.sep) and os.path.isfile(candidate_path):
            os.remove(candidate_path)
    except Exception:
        # Never break request flow if old file cleanup encounters OS race
        pass


async def _process_and_store_profile_photo(
    file: UploadFile,
    current_user: User,
    db: Session,
) -> ProfileResponse:
    if not file or not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No profile photo file provided.",
        )

    # 1. Validate file extension
    raw_basename = os.path.basename(file.filename.strip())
    _, ext = os.path.splitext(raw_basename)
    ext_lower = ext.lower()

    if ext_lower not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file extension '{ext_lower or 'none'}'. Only JPG, JPEG, PNG, and WEBP images are allowed.",
        )

    # Reject suspicious double extensions (e.g. avatar.php.jpg or script.exe.png)
    name_parts = raw_basename.lower().split(".")
    forbidden_parts = {"php", "exe", "sh", "bat", "cmd", "js", "jsp", "py", "pl", "rb", "html", "htm", "svg"}
    if any(part in forbidden_parts for part in name_parts[:-1]):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid filename: potentially executable double extensions are not permitted.",
        )

    # 2. Validate declared MIME type
    content_type = (file.content_type or "").lower().strip()
    if content_type and content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported MIME type '{content_type}'. Allowed MIME types: image/jpeg, image/png, image/webp.",
        )

    # 3. Read file bytes & validate size (max 5 MB)
    contents = await file.read()
    if len(contents) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )
    if len(contents) > MAX_PROFILE_PHOTO_BYTES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File size ({len(contents) / (1024 * 1024):.2f} MB) exceeds maximum limit of {MAX_PROFILE_PHOTO_MB} MB.",
        )

    # 4. Validate binary magic bytes & reject disguised SVG/scripts/executables
    magic_format = _verify_magic_bytes(contents)
    if not magic_format:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid image content: file signature does not match a valid JPEG, PNG, or WEBP image.",
        )

    # 5. Decode and verify actual image structure with Pillow
    try:
        with Image.open(io.BytesIO(contents)) as verify_img:
            verify_img.verify()

        with Image.open(io.BytesIO(contents)) as img:
            pil_format = (img.format or "").upper()
            if pil_format not in ALLOWED_PIL_FORMATS or pil_format != magic_format:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Image format verification failed.",
                )
            width, height = img.size
            if width <= 0 or height <= 0 or width > MAX_IMAGE_DIMENSION or height > MAX_IMAGE_DIMENSION:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Invalid image dimensions ({width}x{height}).",
                )

            # Re-encode image cleanly to strip any arbitrary metadata/payloads
            canonical_ext = ALLOWED_PIL_FORMATS[pil_format]
            output_buffer = io.BytesIO()
            if pil_format == "JPEG":
                clean_img = img.convert("RGB")
                clean_img.save(output_buffer, format="JPEG", quality=90)
            elif pil_format == "PNG":
                clean_img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
                clean_img.save(output_buffer, format="PNG")
            elif pil_format == "WEBP":
                clean_img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
                clean_img.save(output_buffer, format="WEBP", quality=90)

            sanitized_bytes = output_buffer.getvalue()
    except HTTPException:
        raise
    except (UnidentifiedImageError, OSError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Corrupted or invalid image file: {str(exc)}",
        )

    # 6. Generate safe server-side filename and prevent path traversal
    safe_uid = re.sub(r"[^A-Za-z0-9_-]", "", current_user.user_id)
    unique_token = uuid.uuid4().hex[:12]
    safe_filename = f"profile_{safe_uid}_{unique_token}{canonical_ext}"

    profile_dir = os.path.abspath(get_profile_upload_dir())
    target_filepath = os.path.abspath(os.path.join(profile_dir, safe_filename))
    if not target_filepath.startswith(profile_dir + os.sep):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid storage path detected.",
        )

    previous_photo_url = current_user.profile_photo
    is_replacement = bool(previous_photo_url)

    # Write new file to storage first
    with open(target_filepath, "wb") as f:
        f.write(sanitized_bytes)

    new_photo_url = f"/uploads/profiles/{safe_filename}"
    current_user.profile_photo = new_photo_url
    db.commit()
    db.refresh(current_user)

    # Remove old photo only after the new photo is safely stored and committed
    if is_replacement and previous_photo_url != new_photo_url:
        _safe_remove_old_photo(current_user.user_id, previous_photo_url)

    # Record audit log event (without logging image binary content)
    audit_action = "PROFILE_PHOTO_UPDATED" if is_replacement else "PROFILE_PHOTO_UPLOADED"
    log_audit_event(
        db,
        patient_id=current_user.patient_id,
        user_id=current_user.user_id,
        action=audit_action,
        details=(
            f"Profile photo {'replaced' if is_replacement else 'uploaded'} by "
            f"{current_user.user_id} ({current_user.role}). Format: {pil_format}, Size: {len(sanitized_bytes)} bytes."
        ),
    )

    return build_profile_response(current_user)


@router.get("/me", response_model=ProfileResponse)
def get_my_profile(current_user: User = Depends(get_current_user)):
    """
    Returns only the authenticated user's safe profile information:
    name, role, system_id, profile_photo, and default avatar metadata.
    Never exposes password hashes, JWTs, secret keys, or other users' private data.
    """
    return build_profile_response(current_user)


@router.get("/{target_user_id}", response_model=ProfileResponse)
def get_profile_by_id(
    target_user_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    Enforces strict self-access authorization (prevents IDOR across user profiles).
    """
    _enforce_self_authorization(current_user, target_user_id)
    return build_profile_response(current_user)


@router.post("/photo", response_model=ProfileResponse)
@router.put("/photo", response_model=ProfileResponse)
async def upload_or_replace_profile_photo(
    file: UploadFile = File(...),
    user_id: Optional[str] = Form(None, description="Optional user_id; must match authenticated user"),
    target_user_id: Optional[str] = Query(None, alias="user_id", description="Optional user_id query; must match authenticated user"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Uploads or replaces the authenticated user's profile photo.
    Validates extension, MIME type, binary magic bytes, Pillow image integrity, and max size (5 MB).
    """
    _enforce_self_authorization(current_user, user_id)
    _enforce_self_authorization(current_user, target_user_id)
    return await _process_and_store_profile_photo(file=file, current_user=current_user, db=db)


@router.post("/photo/{target_user_id}", response_model=ProfileResponse)
@router.put("/photo/{target_user_id}", response_model=ProfileResponse)
async def upload_profile_photo_for_target(
    target_user_id: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Blocks any attempt by a user to upload or replace another user's profile photo via path parameter.
    """
    _enforce_self_authorization(current_user, target_user_id)
    return await _process_and_store_profile_photo(file=file, current_user=current_user, db=db)


@router.delete("/photo", response_model=ProfileResponse)
def delete_my_profile_photo(
    target_user_id: Optional[str] = Query(None, alias="user_id"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Deletes the authenticated user's profile photo and resets to the default initials avatar state.
    """
    _enforce_self_authorization(current_user, target_user_id)

    previous_photo_url = current_user.profile_photo
    current_user.profile_photo = None
    db.commit()
    db.refresh(current_user)

    if previous_photo_url:
        _safe_remove_old_photo(current_user.user_id, previous_photo_url)

    log_audit_event(
        db,
        patient_id=current_user.patient_id,
        user_id=current_user.user_id,
        action="PROFILE_PHOTO_DELETED",
        details=f"Profile photo deleted by {current_user.user_id} ({current_user.role}). Reset to default initials avatar.",
    )

    return build_profile_response(current_user)


@router.delete("/photo/{target_user_id}", response_model=ProfileResponse)
def delete_profile_photo_for_target(
    target_user_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Blocks any attempt by a user to delete another user's profile photo via path parameter.
    """
    _enforce_self_authorization(current_user, target_user_id)
    return delete_my_profile_photo(target_user_id=target_user_id, db=db, current_user=current_user)
