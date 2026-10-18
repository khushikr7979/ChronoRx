"""
ChronoRx Multilingual Translation Service
Supports all 22 scheduled languages of India (Eighth Schedule of the Constitution of India).
Strictly preserves drug names, strengths, numbers, units, and clinical parameters.
"""
import re
import hashlib
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.models.models import TranslationVerification

# The 22 Scheduled Languages of India + English reference
INDIAN_SCHEDULED_LANGUAGES: List[Dict[str, Any]] = [
    {"code": "en", "name": "English", "native_name": "English", "script": "Latin", "direction": "ltr", "is_scheduled_language": False},
    {"code": "as", "name": "Assamese", "native_name": "অসমীয়া", "script": "Bengali-Assamese", "direction": "ltr", "is_scheduled_language": True},
    {"code": "bn", "name": "Bengali", "native_name": "বাংলা", "script": "Bengali", "direction": "ltr", "is_scheduled_language": True},
    {"code": "brx", "name": "Bodo", "native_name": "बर'", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "doi", "name": "Dogri", "native_name": "डोगरी", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "gu", "name": "Gujarati", "native_name": "ગુજરાતી", "script": "Gujarati", "direction": "ltr", "is_scheduled_language": True},
    {"code": "hi", "name": "Hindi", "native_name": "हिन्दी", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "kn", "name": "Kannada", "native_name": "ಕನ್ನಡ", "script": "Kannada", "direction": "ltr", "is_scheduled_language": True},
    {"code": "ks", "name": "Kashmiri", "native_name": "कॉशुर / کٲشُر", "script": "Perso-Arabic", "direction": "rtl", "is_scheduled_language": True},
    {"code": "kok", "name": "Konkani", "native_name": "कोंकणी", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "mai", "name": "Maithili", "native_name": "मैथिली", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "ml", "name": "Malayalam", "native_name": "മലയാളം", "script": "Malayalam", "direction": "ltr", "is_scheduled_language": True},
    {"code": "mni", "name": "Manipuri (Meitei)", "native_name": "মৈতৈলোন্", "script": "Meitei Mayek", "direction": "ltr", "is_scheduled_language": True},
    {"code": "mr", "name": "Marathi", "native_name": "मराठी", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "ne", "name": "Nepali", "native_name": "नेपाली", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "or", "name": "Odia", "native_name": "ଓଡ଼ିଆ", "script": "Odia", "direction": "ltr", "is_scheduled_language": True},
    {"code": "pa", "name": "Punjabi", "native_name": "ਪੰਜਾਬੀ", "script": "Gurmukhi", "direction": "ltr", "is_scheduled_language": True},
    {"code": "sa", "name": "Sanskrit", "native_name": "संस्कृतम्", "script": "Devanagari", "direction": "ltr", "is_scheduled_language": True},
    {"code": "sat", "name": "Santali", "native_name": "ᱥᱟᱱᱛᱟᱲᱤ", "script": "Ol Chiki", "direction": "ltr", "is_scheduled_language": True},
    {"code": "sd", "name": "Sindhi", "native_name": "سنڌي", "script": "Perso-Arabic", "direction": "rtl", "is_scheduled_language": True},
    {"code": "ta", "name": "Tamil", "native_name": "தமிழ்", "script": "Tamil", "direction": "ltr", "is_scheduled_language": True},
    {"code": "te", "name": "Telugu", "native_name": "తెలుగు", "script": "Telugu", "direction": "ltr", "is_scheduled_language": True},
    {"code": "ur", "name": "Urdu", "native_name": "اردو", "script": "Perso-Arabic", "direction": "rtl", "is_scheduled_language": True},
]

LANG_MAP = {l["code"]: l for l in INDIAN_SCHEDULED_LANGUAGES}

# Common High-Frequency Clinical Instructions in 22 Indian Languages + English
CLINICAL_DICTIONARY: Dict[str, Dict[str, str]] = {
    "Take after meals": {
        "hi": "भोजन के बाद लें",
        "bn": "খাওয়ার পরে গ্রহণ করুন",
        "ta": "உணவுக்குப் பிறகு உட்கொள்ளவும்",
        "te": "భోజనం తర్వాత తీసుకోండి",
        "mr": "जेवणानंतर घ्या",
        "gu": "જમ્યા પછી લો",
        "kn": "ಊಟದ ನಂತರ ತೆಗೆದುಕೊಳ್ಳಿ",
        "ml": "ഭക്ഷണത്തിന് ശേഷം കഴിക്കുക",
        "pa": "ਖਾਣੇ ਤੋਂ ਬਾਅਦ ਲਵੋ",
        "ur": "کھانے کے بعد لیں",
        "or": "ଖାଇବା ପରେ ନିଅନ୍ତୁ",
        "as": "খোৱাৰ পিছত লব",
        "ne": "खाना खाएपछि लिनुहोस्",
        "sa": "भोजनानन्तरं स्वीकरोतु",
        "kok": "जेवणा उपरांत घेवचे",
        "mai": "भोजनक बाद ली",
        "doi": "रोटी खांदे बाद लैओ",
        "ks": "کھؠنہٕ پتہٕ لِیو",
        "sd": "کاڌي کان پوءِ وٺو",
        "brx": "जाखांनायनि उनाव ला",
        "sat": "ᱡᱚᱢ ᱛᱟᱭᱚᱢ ᱤᱫᱤ ᱢᱮ",
        "mni": "চাক চারবা মতুংদা চাউ",
    },
    "Take before meals": {
        "hi": "भोजन से पहले लें (खाली पेट)",
        "bn": "খাওয়ার আগে গ্রহণ করুন (খালি পেটে)",
        "ta": "உணவுக்கு முன் உட்கொள்ளவும் (வெறும் வயிற்றில்)",
        "te": "భోజనానికి ముందు తీసుకోండి (ఖాళీ కడుపుతో)",
        "mr": "जेवणापूर्वी घ्या (उपाशी पोटी)",
        "gu": "જમ્યા પહેલાં લો (ખાલી પેટે)",
        "kn": "ಊಟಕ್ಕೆ ಮುಂಚೆ ತೆಗೆದುಕೊಳ್ಳಿ (ಖಾಲಿ ಹೊಟ್ಟೆಯಲ್ಲಿ)",
        "ml": "ഭക്ഷണത്തിന് മുൻപ് കഴിക്കുക (വെറുംവയറ്റിൽ)",
        "pa": "ਖਾਣੇ ਤੋਂ ਪਹਿਲਾਂ ਲਵੋ (ਖਾਲੀ ਪੇਟ)",
        "ur": "کھانے سے پہلے لیں (نہار منہ)",
        "or": "ଖାଇବା ପୂର୍ବରୁ ନିଅନ୍ତୁ (ଖାଲି ପେଟରେ)",
        "as": "খোৱাৰ আগত লব (খালী পেটত)",
        "ne": "खाना खानु अगाडि लिनुहोस्",
        "sa": "भोजनात् पूर्वं स्वीकरोतु",
        "kok": "जेवणा पयलीं घेवचे",
        "mai": "भोजन सं पहिने ली",
        "doi": "रोटी खांदे पैहले लैओ",
        "ks": "کھؠنہٕ برونٛہہ لِیو",
        "sd": "کاڌي کان اڳ وٺو",
        "brx": "जानायनि सिगां ला",
        "sat": "ᱡᱚᱢ ᱢᱟᱬᱟᱝ ᱨᱮ ᱤᱫᱤ ᱢᱮ",
        "mni": "চাক চাদ্রিঙৈদা চাউ",
    },
    "Take with water": {
        "hi": "पर्याप्त पानी के साथ लें",
        "bn": "পর্যাপ্ত জল সহ গ্রহণ করুন",
        "ta": "போதுமான தண்ணீருடன் உட்கொள்ளவும்",
        "te": "సరిపడా నీటితో తీసుకోండి",
        "mr": "भरपूर पाण्यासोबत घ्या",
        "gu": "પૂરતા પાણી સાથે લો",
        "kn": "ಸಾಕಷ್ಟು ನೀರಿನೊಂದಿಗೆ ತೆಗೆದುಕೊಳ್ಳಿ",
        "ml": "ധാരാളം വെള്ളത്തോടൊപ്പം കഴിക്കുക",
        "pa": "ਪਾਣੀ ਨਾਲ ਲਵੋ",
        "ur": "پانی کے ساتھ لیں",
        "or": "ପାଣି ସହିତ ନିଅନ୍ତୁ",
        "as": "পানীৰ সৈতে লব",
        "ne": "पानीसँग लिनुहोस्",
        "sa": "जलेन सह स्वीकरोतु",
        "kok": "उदका सांगता घेवचे",
        "mai": "पानिक संग ली",
        "doi": "पानी कन्ने लैओ",
        "ks": "آبہٕ سۭتہِ لِیو",
        "sd": "پاڻي سان وٺو",
        "brx": "दैजों ला",
        "sat": "ᱫᱟᱜ ᱥᱟᱶᱛᱮ ᱤᱫᱤ ᱢᱮ",
        "mni": "ঈশিংগা লোয়ননা চাউ",
    },
    "Do not crush or chew": {
        "hi": "दवा को कुचलें या चबाएं नहीं, पूरा निगलें",
        "bn": "ওষুধটি চিবিয়ে বা গুঁড়ো করে খাবেন না, পুরোটা গিলুন",
        "ta": "மருந்தை நசுக்கவோ மெல்லவோ வேண்டாம், முழுதாக விழுங்கவும்",
        "te": "మందును నమలడం లేదా పొడి చేయడం చేయవద్దు",
        "mr": "गोळी चावू नका किंवा बारीक करू नका, पूर्ण गिळा",
        "gu": "ગોળીને ચાવો નહીં અથવા ભૂકો ન કરો",
        "kn": "ಔಷಧಿಯನ್ನು ಪುಡಿ ಮಾಡಬೇಡಿ ಅಥವಾ ಅಗಿಯಬೇಡಿ",
        "ml": "ഗുളിക ചവച്ചരക്കുകയോ പൊടിക്കുകയോ ചെയ്യരുത്",
        "pa": "ਦਵਾਈ ਨੂੰ ਚਬਾਉਣਾ ਜਾਂ ਤੋੜਨਾ ਨਹੀਂ ਹੈ",
        "ur": "دوا کو چبائیں یا توڑیں نہیں، پوری نگل لیں",
        "or": "ଔଷଧକୁ ଚୋବାନ୍ତୁ ବା ଗୁଣ୍ଡ କରନ୍ତୁ ନାହିଁ",
        "as": "ওষধখিনি চোবাই বা ভাঙি নাখাব",
        "ne": "औषधी नचबाईकन पूरै निल्नुहोस्",
        "sa": "औषधं न चर्वयतु, सम्पूर्णं गिलतु",
        "kok": "वखत चाबूं नाकात",
        "mai": "दवाइ कें कूचि वा चबा कऽ नहि खाउ",
        "doi": "दवाई गी चबाना नेईं",
        "ks": "دَوا ہؠکھِو نہٕ ژٔپِتھ",
        "sd": "دوا کي چٻاڙڻ يا چورو نه ڪريو",
        "brx": "मुलाइखौ गाबना जायनो नाङा",
        "sat": "ᱨᱟᱱ ᱫᱚ ᱟᱞᱚᱢ ᱨᱟᱹᱯᱩᱫᱟ ᱟᱨ ᱟᱞᱚᱢ ᱛᱚᱜᱚᱭᱟ",
        "mni": "হিদাক অসি চাম্বীগনু",
    },
    "Avoid alcohol": {
        "hi": "इस दवा के दौरान शराब का सेवन बिल्कुल न करें",
        "bn": "এই চিকিৎসার সময় মদ্যপান পরিহার করুন",
        "ta": "இந்த மருந்தின் போது மது அருந்துவதை தவிர்க்கவும்",
        "te": "ఈ మందు వాడేటప్పుడు మద్యపానం చేయవద్దు",
        "mr": "या औषधाच्या काळात मद्यपान टाळा",
        "gu": "આ દવા દરમિયાન દારૂનું સેવન ટાળો",
        "kn": "ಈ ಔಷಧದ ಸಮಯದಲ್ಲಿ ಮದ್ಯಪಾನ ಮಾಡಬೇಡಿ",
        "ml": "ഈ മരുന്ന് കഴിക്കുമ്പോൾ മദ്യം ഒഴിവാക്കുക",
        "pa": "ਸ਼ਰਾਬ ਦੀ ਵਰਤੋਂ ਤੋਂ ਪਰਹੇਜ਼ ਕਰੋ",
        "ur": "اس دوا کے دوران الکحل سے مکمل پرہیز کریں",
        "or": "ଏହି ଔଷଧ ସମୟରେ ମଦ୍ୟପାନ ବର୍ଜନ କରନ୍ତୁ",
        "as": "এই ঔষধ লোৱাৰ সময়ত মদ বৰ্জন কৰক",
        "ne": "यो औषधी लिँदा मदिरा सेवन नगर्नुहोस्",
        "sa": "औषधसेवनकाले मद्यपानं वर्जयतु",
        "kok": "सोरो पिवप टाळात",
        "mai": "मदिरा पान सँ बचू",
        "doi": "शराब शा नेईं पीना",
        "ks": "شراب نِشِہ روٗزِو دوٗر",
        "sd": "شراب واپرائڻ کان پاسو ڪريو",
        "brx": "जौ लोङाजानाय ला",
        "sat": "ᱦᱟᱺᱰᱤ ᱟᱞᱚᱢ ᱧᱩᱭᱟ",
        "mni": "য়ু থকপীবীগনু",
    },
    "Report adverse side effects immediately": {
        "hi": "यदि कोई गंभीर दुष्प्रभाव या एलर्जी दिखे तो तुरंत डॉक्टर को सूचित करें",
        "bn": "কোনো প্রতিকূল পার্শ্বপ্রতিক্রিয়া দেখা দিলে অবিলম্বে ডাক্তারকে জানান",
        "ta": "ஏதேனும் பாதகமான பக்கவிளைவுகள் ஏற்பட்டால் உடனடியாக மருத்துவரிடம் தெரிவிக்கவும்",
        "te": "ఏవైనా ప్రతికూల దుష్ప్రభావాలు కనిపిస్తే వెంటనే వైద్యుడికి నివేదించండి",
        "mr": "कोणतेही दुष्परिणाम जाणवल्यास त्वरित डॉक्टरांना कळवा",
        "gu": "કોઈ આડઅસર જણાય તો તરત જ ડૉક્ટરને જાણ કરો",
        "kn": "ಯಾವುದೇ ಅಡ್ಡಪರಿಣಾಮ ಕಂಡುಬಂದರೆ ತಕ್ಷಣ ವೈದ್ಯರಿಗೆ ತಿಳಿಸಿ",
        "ml": "പാർശ്വഫലങ്ങൾ ഉണ്ടായാൽ ഉടൻ ഡോക്ടറെ അറിയിക്കുക",
        "pa": "ਜੇ ਕੋਈ ਬੁਰਾ ਪ੍ਰਭਾਵ ਪਵੇ ਤਾਂ ਤੁਰੰਤ ਡਾਕਟਰ ਨਾਲ ਸੰਪਰਕ ਕਰੋ",
        "ur": "کوئی منفی اثرات یا الرجی ہو تو فوری طور پر ڈاکٹر کو مطلع کریں",
        "or": "କୌଣସି ପାର୍ଶ୍ୱ ପ୍ରତିକ୍ରିୟା ହେଲେ ତୁରନ୍ତ ଡାକ୍ତରଙ୍କୁ ଜଣାନ୍ତୁ",
        "as": "কোনো পাৰ্শ্বক্ৰিয়া দেখা দিলে ততালিকে চিকিৎসকক জনাওক",
        "ne": "कुनै प्रतिकूल असर देखिएमा तुरुन्तै चिकित्सकलाई सम्पर्क गर्नुहोस्",
        "sa": "यदि कोऽपि पार्श्वप्रभावः दृश्यते तर्हि शीघ्रं वैद्यं सूचयतु",
        "kok": "कसलेय दुष्परिणाम जाल्यार ताबडतोब दोतोरक सांगात",
        "mai": "कोनो दुष्प्रभाव भेला पर तुरंत डॉक्टर सँ सम्पर्क करू",
        "doi": "कुसै खराबी दी सुरत च तुरंत डाक्टर कन्ने गल्ल करो",
        "ks": "کانٛہہ نقصان گژھنہٕ پؠٹھ کٔرِو ڈاکٹَرس فوری خَبَر",
        "sd": "ڪنهن به خراب اثر جي صورت ۾ فوري طور تي ڊاڪٽر سان رابطو ڪريو",
        "brx": "माखासे गाज्रि जाथाइ नुजाथिब्ला डाक्टरनो खौरां हर",
        "sat": "ᱡᱟᱦᱟᱱ ᱵᱟᱹᱲᱤᱡ ᱚᱨᱡᱚ ᱧᱮᱞ ᱞᱮᱱᱠᱷᱟᱱ ᱞᱚᱜᱚᱱ ᱰᱟᱠᱛᱚᱨ ᱞᱟᱹᱭᱟᱭ ᱢᱮ",
        "mni": "অমাং-অতা থোক্লবদি লাইয়েংবদা থুনা পাও পীবীয়ু",
    },
    "As directed by physician": {
        "hi": "चिकित्सक के निर्देशानुसार लें",
        "bn": "চিকিৎসকের নির্দেশ অনুযায়ী গ্রহণ করুন",
        "ta": "மருத்துவரின் அறிவுறுத்தலின்படி உட்கொள்ளவும்",
        "te": "వైద్యుని సూచనల మేరకు తీసుకోండి",
        "mr": "वैद्यकीय सल्ल्यानुसार घ्या",
        "gu": "તબીબની સૂચના મુજબ લો",
        "kn": "ವೈದ್ಯರ ಸಲಹೆಯಂತೆ ತೆಗೆದುಕೊಳ್ಳಿ",
        "ml": "ഡോക്ടറുടെ നിർദ്ദേശപ്രകാരം കഴിക്കുക",
        "pa": "ਡਾਕਟਰ ਦੀ ਹਦਾਇਤ ਅਨੁਸਾਰ ਲਵੋ",
        "ur": "معالج کی ہدایات کے مطابق استعمال کریں",
        "or": "ଡାକ୍ତରଙ୍କ ନିର୍ଦ୍ଦେଶ ଅନୁଯାୟୀ ନିଅନ୍ତୁ",
        "as": "চিকিৎসকৰ নিৰ্দেশ মতেই লওক",
        "ne": "चिकित्सकको सल्लाह अनुसार लिनुहोस्",
        "sa": "वैद्यस्य निर्देशानुसारं स्वीकरोतु",
        "kok": "दोतोराच्या सुचोवणे प्रमाणे घेवचे",
        "mai": "चिकित्सकक निर्देशानुसार ली",
        "doi": "डाक्टर दी सलाह मताबिक लैओ",
        "ks": "ڈاکٹَر سٕندِ ہدایت مُطابق اِستعمال کٔرِو",
        "sd": "ڊاڪٽر جي هدايت موجب وٺو",
        "brx": "डाक्टरनि बिथोन बादियै ला",
        "sat": "ᱰᱟᱠᱛᱚᱨᱟᱜ ᱫᱤᱥᱟᱹ ᱦᱩᱫᱤᱥ ᱞᱮᱠᱟᱛᱮ ᱤᱫᱤ ᱢᱮ",
        "mni": "লাইয়েংবগী য়াথং মতুংইন্না চাউ",
    },
    "Morning - Before breakfast": {
        "hi": "सुबह - नाश्ते से पहले",
        "bn": "সকাল - প্রাতঃরাশের আগে",
        "ta": "காலை - காலை உணவுக்கு முன்",
        "te": "ఉదయం - అల్పాహారానికి ముందు",
        "mr": "सकाळी - न्याहारीपूर्वी",
        "gu": "સવારે - નાસ્તા પહેલાં",
        "kn": "ಬೆಳಿಗ್ಗೆ - ಉಪಹಾರಕ್ಕೆ ಮುಂಚೆ",
        "ml": "രാവിലെ - പ്രഭാതഭക്ഷണത്തിന് മുൻപ്",
        "pa": "ਸਵੇਰੇ - ਨਾਸ਼ਤੇ ਤੋਂ ਪਹਿਲਾਂ",
        "ur": "صبح - ناشتے سے پہلے",
        "or": "ସକାଳେ - ଜଳଖିଆ ପୂର୍ବରୁ",
        "as": "ৰাতিপুৱা - জলপানৰ আগত",
        "ne": "बिहान - खाजा खानु अघि",
        "sa": "प्रातः - अल्पाहारात् पूर्वम्",
        "kok": "सकाळीं - नाश्त्या पयलीं",
        "mai": "प्रातः - जलपान सँ पहिने",
        "doi": "सवेरे - चहा-नाश्ते थमां पैहले",
        "ks": "صُبحَس - نَہار برونٛہہ",
        "sd": "صبح - ناشتي کان اڳ",
        "brx": "फुंआव - फुंनि जामुं सिगां",
        "sat": "ᱥᱮᱛᱟᱜ - ᱱᱟᱥᱛᱟ ᱢᱟᱬᱟᱝ ᱨᱮ",
        "mni": "অয়ুক - অয়ুক্কী চা চাদ্রিঙৈদা",
    },
    "Morning - With breakfast": {
        "hi": "सुबह - नाश्ते के साथ",
        "bn": "সকাল - প্রাতঃরাশের সাথে",
        "ta": "காலை - காலை உணவுடன்",
        "te": "ఉదయం - అల్పాహారంతో",
        "mr": "सकाळी - न्याहारीसोबत",
        "gu": "સવારે - નાસ્તા સાથે",
        "kn": "ಬೆಳಿಗ್ಗೆ - ಉಪಹಾರದೊಂದಿಗೆ",
        "ml": "രാവിലെ - പ്രഭാതഭക്ഷണത്തോടൊപ്പം",
        "pa": "ਸਵੇਰੇ - ਨਾਸ਼ਤੇ ਦੇ ਨਾਲ",
        "ur": "صبح - ناشتے کے ساتھ",
        "or": "ସକାଳେ - ଜଳଖିଆ ସହିତ",
        "as": "ৰাতিপুৱা - জলপানৰ সৈতে",
        "ne": "बिहान - खाजासँग",
        "sa": "प्रातः - अल्पाहारेण सह",
        "kok": "सकाळीं - नाश्त्या बरोबर",
        "mai": "प्रातः - जलपानक संग",
        "doi": "सवेरे - नाश्ते कन्ने",
        "ks": "صُبحَس - نَہارَس سۭتہِ",
        "sd": "صبح - ناشتي سان",
        "brx": "फुंआव - फुंनि जामुं जों",
        "sat": "ᱥᱮᱛᱟᱜ - ᱱᱟᱥᱛᱟ ᱥᱟᱶᱛᱮ",
        "mni": "অয়ুক - অয়ুক্কী চা লোয়ননা",
    },
    "Night - At bedtime": {
        "hi": "रात - सोने से पहले",
        "bn": "রাত - ঘুমানোর আগে",
        "ta": "இரவு - தூங்குவதற்கு முன்",
        "te": "రాత్రి - పడుకునే ముందు",
        "mr": "रात्री - झोपण्यापूर्वी",
        "gu": "રાત્રે - સૂતા પહેલાં",
        "kn": "ರಾತ್ರಿ - ಮಲಗುವ ಮುನ್ನ",
        "ml": "രാത്രി - ഉറങ്ങുന്നതിന് മുൻപ്",
        "pa": "ਰਾਤ - ਸੌਣ ਤੋਂ ਪਹਿਲਾਂ",
        "ur": "رات - سونے سے پہلے",
        "or": "ରାତିରେ - ଶୋଇବା ପୂର୍ବରୁ",
        "as": "ৰাতি - শোৱাৰ আগত",
        "ne": "राती - सुत्नु अघि",
        "sa": "रात्रौ - शयनात् पूर्वम्",
        "kok": "रातीं - न्हिदचे पयलीं",
        "mai": "राति - सुतय सँ पहिने",
        "doi": "राती - सौने थमां पैहले",
        "ks": "راتَس - شۄنٛگنَہ برونٛہہ",
        "sd": "رات - سمهڻ کان اڳ",
        "brx": "हरआव - उन्दुनाय सिगां",
        "sat": "ᱧᱤᱫᱟᱹ - ᱡᱟᱹᱯᱤᱫ ᱢᱟᱬᱟᱝ ᱨᱮ",
        "mni": "নুমিদাং - তুমদ্রিঙৈদা",
    },
    "Afternoon - With lunch": {
        "hi": "दोपहर - दोपहर के भोजन के साथ",
        "bn": "দুপুর - দুপুরের খাবারের সাথে",
        "ta": "மதியம் - மதிய உணவுடன்",
        "te": "మధ్యాహ్నం - మధ్యాహ్న భోజనంతో",
        "mr": "दुपारी - दुपारच्या जेवणासोबत",
        "gu": "બપોરે - બપોરના ભોજન સાથે",
        "kn": "ಮಧ್ಯಾಹ್ನ - ಮಧ್ಯಾಹ್ನದ ಊಟದೊಂದಿಗೆ",
        "ml": "ഉച്ചയ്ക്ക് - ഉച്ചഭക്ഷണത്തോടൊപ്പം",
        "pa": "ਦੁਪਹਿਰ - ਦੁਪਹਿਰ ਦੇ ਖਾਣੇ ਨਾਲ",
        "ur": "دوپہر - دوپہر کے کھانے کے ساتھ",
        "or": "ମଧ୍ୟାହ୍ନ - ମଧ୍ୟାହ୍ନ ଭୋଜନ ସହିତ",
        "as": "দুপৰীয়া - দুপৰীয়াৰ আহাৰৰ সৈতে",
        "ne": "दिउँसो - दिउँसोको खानासँग",
        "sa": "मध्याह्ने - मध्याह्नभोजनेन सह",
        "kok": "दोनपरां - दोनपारच्या जेवणा बरोबर",
        "mai": "दुपहरिया - भोजनक संग",
        "doi": "दपैह्रे - रोटी कन्ने",
        "ks": "دۄپَہَرَس - کھؠنَس سۭتہِ",
        "sd": "منجهند - ماني سان",
        "brx": "सानजौफुं - ओंखाम जों",
        "sat": "ᱛᱤᱠᱤᱱ - ᱢᱟᱡᱷᱟᱱ ᱫᱟᱠᱟ ᱥᱟᱶᱛᱮ",
        "mni": "নুংথিল - নুংথিলগী চাক লোয়ননা",
    },
    "Evening - With dinner": {
        "hi": "शाम/रात - रात के भोजन के साथ",
        "bn": "সন্ধ্যা/রাত - নৈশভোজের সাথে",
        "ta": "மாலை/இரவு - இரவு உணவுடன்",
        "te": "సాయంత్రం/రాత్రి - రాత్రి భోజనంతో",
        "mr": "संध्याकाळी/रात्री - रात्रीच्या जेवणासोबत",
        "gu": "સાંજે/રાત્રે - રાત્રિ ભોજન સાથે",
        "kn": "ಸಂಜೆ/ರಾತ್ರಿ - ರಾತ್ರಿಯ ಊಟದೊಂದಿಗೆ",
        "ml": "വൈകുന്നേരം/രാത്രി - അത്താഴത്തോടൊപ്പം",
        "pa": "ਸ਼ਾਮ/ਰਾਤ - ਰਾਤ ਦੇ ਖਾਣੇ ਨਾਲ",
        "ur": "شام/رات - رات کے کھانے کے ساتھ",
        "or": "ସନ୍ଧ୍ୟା/ରାତି - ରାତ୍ରିଭୋଜନ ସହିତ",
        "as": "সন্ধিয়া/ৰাতি - ৰাতিৰ সাজৰ সৈতে",
        "ne": "साँझ/राती - बेलुकाको खानासँग",
        "sa": "सायं/रात्रौ - सायंभोजनेन सह",
        "kok": "सांजेर/रातीं - रातीच्या जेवणा बरोबर",
        "mai": "साँझ/राति - ब्यालूक संग",
        "doi": "संज्या/राती - रातली रोटी कन्ने",
        "ks": "شامَس/راتَس - شامٕچ کھؠنَس سۭتہِ",
        "sd": "شام/رات - رات جي ماني سان",
        "brx": "बेलासे/हर - हरनि ओंखाम जों",
        "sat": "ᱟᱹᱭᱩᱵ/ᱧᱤᱫᱟᱹ - ᱧᱤᱫᱟᱹ ᱫᱟᱠᱟ ᱥᱟᱶᱛᱮ",
        "mni": "নুমিদাং - চাক লোয়ননা",
    }
}

# Regex for clinical parameters to preserve untouched (Drug names, Strengths, Units, Durations)
PRESERVE_REGEX = re.compile(
    r'\b(?:\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?|tablets?|capsules?|drops?|puffs?|sachets?|%|bid|tid|qid|od|prn|stat)\b|'
    r'\b(?:\d+\s*(?:days?|weeks?|months?))\b|'
    r'\b(?:[A-Z][a-z0-9]+(?:\s+[A-Z][a-z0-9]+)*\s+\d+(?:\.\d+)?\s*(?:mg|ml|mcg))\b)',
    re.IGNORECASE
)

def compute_content_hash(text: str, target_lang: str) -> str:
    """Computes a unique SHA-256 hash for original instruction and target language."""
    clean = text.strip().lower()
    return hashlib.sha256(f"{target_lang}:{clean}".encode("utf-8")).hexdigest()

def mask_medical_terms(text: str) -> Tuple[str, Dict[str, str]]:
    """
    Masks clinical drug names, dosages, strengths, and units with numbered placeholders
    so they cannot be corrupted or mistranslated.
    """
    matches = list(PRESERVE_REGEX.finditer(text))
    tokens = {}
    masked_text = text

    # Replace from back to front to preserve string indices
    for idx, match in enumerate(reversed(matches)):
        val = match.group(0)
        token_key = f"__RX_MED_{len(matches) - 1 - idx}__"
        tokens[token_key] = val
        start, end = match.span()
        masked_text = masked_text[:start] + token_key + masked_text[end:]

    return masked_text, tokens

def unmask_medical_terms(masked_text: str, tokens: Dict[str, str]) -> str:
    """Restores the exact original drug names and clinical parameters."""
    result = masked_text
    for token_key, original_val in tokens.items():
        result = result.replace(token_key, original_val)
    return result

def get_language_info(code: str) -> Dict[str, Any]:
    """Retrieves language metadata for a language code."""
    c = code.lower().strip()
    return LANG_MAP.get(c, {
        "code": c,
        "name": c.capitalize(),
        "native_name": c.capitalize(),
        "script": "Unknown",
        "direction": "ltr",
        "is_scheduled_language": False
    })

def translate_phrase(text: str, target_lang: str) -> Optional[str]:
    """Checks dictionary for an exact match or close match."""
    t_clean = text.strip()
    for phrase, translations in CLINICAL_DICTIONARY.items():
        if phrase.lower() == t_clean.lower() and target_lang in translations:
            return translations[target_lang]
        if phrase.lower() in t_clean.lower() and target_lang in translations:
            # Partial substitution
            return t_clean.lower().replace(phrase.lower(), translations[target_lang])
    return None

def translate_clinical_text(
    text: str,
    target_language: str,
    source_language: str = "en",
    preserve_medical_terms: bool = True,
    db: Optional[Session] = None
) -> Dict[str, Any]:
    """
    Translates medical instruction into one of the 22 Indian scheduled languages.
    Ensures drug names, dosages, units, and numbers are strictly uncorrupted.
    Checks for clinician verification status.
    """
    target_lang = target_language.lower().strip()
    lang_info = get_language_info(target_lang)

    # 1. Identity check: if target is same as source (e.g. English), return original
    if target_lang == source_language.lower() or not text.strip():
        return {
            "original_text": text,
            "translated_text": text,
            "target_language": target_lang,
            "source_language": source_language,
            "status": "Original-Reference",
            "direction": lang_info.get("direction", "ltr"),
            "preserved_terms": [],
            "engine": "ChronoRx-Preserve-Engine",
            "disclaimer": "Original clinician-approved instructions are the legal medical reference."
        }

    # 2. Check Database for Prior Clinician Verification
    content_hash = compute_content_hash(text, target_lang)
    if db:
        verification = db.query(TranslationVerification).filter(
            TranslationVerification.content_hash == content_hash
        ).first()
        if verification:
            return {
                "original_text": text,
                "translated_text": verification.translated_text,
                "target_language": target_lang,
                "source_language": source_language,
                "status": "Clinician-Verified",
                "is_verified": True,
                "direction": lang_info.get("direction", "ltr"),
                "preserved_terms": [],
                "engine": f"Verified-by-{verification.verified_by}",
                "disclaimer": "This translation has been verified by an authorized clinician."
            }

    # 3. Mask clinical parameters
    tokens = {}
    masked_text = text
    preserved_terms = []
    if preserve_medical_terms:
        masked_text, tokens = mask_medical_terms(text)
        preserved_terms = list(tokens.values())

    # 4. Attempt exact dictionary translation
    dict_translation = translate_phrase(text, target_lang)
    if dict_translation:
        translated = dict_translation
    else:
        # Check phrase match on masked text
        masked_dict = translate_phrase(masked_text, target_lang)
        if masked_dict:
            translated = unmask_medical_terms(masked_dict, tokens)
        else:
            # Fallback Rule-Based & Component-wise Clinical Translator for 22 languages
            translated = _fallback_component_translate(masked_text, target_lang, tokens)

    # Re-inject preserved terms if not already unmasked
    translated = unmask_medical_terms(translated, tokens)

    # Translation Safety: If no translation occurred, do NOT falsely claim "Machine-Translated"
    if translated.strip() == text.strip() and target_lang != "en":
        return {
            "original_text": text,
            "translated_text": text,
            "target_language": target_lang,
            "source_language": source_language,
            "status": "Translation Unavailable",
            "is_verified": False,
            "direction": lang_info.get("direction", "ltr"),
            "preserved_terms": preserved_terms,
            "engine": "ChronoRx-Clinical-NLP-v1",
            "disclaimer": "Dynamic translation is currently unavailable for this specific instruction in the selected language. Original clinician-authored English instructions are preserved for clinical safety."
        }

    return {
        "original_text": text,
        "translated_text": translated,
        "target_language": target_lang,
        "source_language": source_language,
        "status": "Machine-Translated",
        "is_verified": False,
        "direction": lang_info.get("direction", "ltr"),
        "preserved_terms": preserved_terms,
        "engine": "ChronoRx-Clinical-NLP-v1",
        "disclaimer": "Machine translation for patient convenience. Clinical diagnosis and dosing must be verified with your clinician."
    }

def _fallback_component_translate(masked_text: str, target_lang: str, tokens: Dict[str, str]) -> str:
    """
    Substitutes recognized clinical instruction segments piece by piece while leaving masked
    medication and dosage tokens intact.
    """
    result = masked_text
    for en_phrase, translations in CLINICAL_DICTIONARY.items():
        if target_lang in translations:
            pattern = re.compile(re.escape(en_phrase), re.IGNORECASE)
            result = pattern.sub(translations[target_lang], result)

    # Common sub-words / connectors
    connectors = {
        "with food": {
            "hi": "भोजन के साथ", "bn": "খাবারের সাথে", "ta": "உணவுடன்", "te": "ఆహారంతో",
            "mr": "अन्नासोबत", "gu": "ખોરાક સાથે", "kn": "ಆಹಾರದೊಂದಿಗೆ", "ml": "ഭക്ഷണത്തോടൊപ്പം",
            "pa": "ਖਾਣੇ ਦੇ ਨਾਲ", "ur": "کھانے کے ساتھ"
        },
        "on empty stomach": {
            "hi": "खाली पेट", "bn": "খালি পেটে", "ta": "வெறும் வயிற்றில்", "te": "ఖాళీ కడుపుతో",
            "mr": "उपाशी पोटी", "gu": "ખાલી પેટે", "kn": "ಖಾಲಿ ಹೊಟ್ಟೆಯಲ್ಲಿ", "ml": "വെറുംവയറ്റിൽ",
            "pa": "ਖਾਲੀ ਪੇਟ", "ur": "نہار منہ"
        },
        "once daily": {
            "hi": "दिन में एक बार", "bn": "দিনে একবার", "ta": "நாளைக்கு ஒரு முறை", "te": "రోజుకు ఒకసారి",
            "mr": "दिवसातून एकदा", "gu": "દિવસમાં એક વાર", "kn": "ದಿನಕ್ಕೆ ಒಮ್ಮೆ", "ml": "ദിവസത്തിൽ ഒരിക്കൽ",
            "pa": "ਦਿਨ ਵਿੱਚ ਇੱਕ ਵਾਰ", "ur": "دن میں ایک بار"
        },
        "twice daily": {
            "hi": "दिन में दो बार", "bn": "দিনে দুবার", "ta": "நாளைக்கு இருமுறை", "te": "రోజుకు రెండుసార్లు",
            "mr": "दिवसातून दोनदा", "gu": "દિવસમાં બે વાર", "kn": "ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ", "ml": "ദിവസത്തിൽ രണ്ടുതവണ",
            "pa": "ਦਿਨ ਵਿੱਚ ਦੋ ਵਾਰ", "ur": "دن میں دو بار"
        },
        "thrice daily": {
            "hi": "दिन में तीन बार", "bn": "দিনে তিনবার", "ta": "நாளைக்கு மூன்று முறை", "te": "రోజుకు మూడుసార్లు",
            "mr": "दिवसातून तीनदा", "gu": "દિવસમાં ત્રણ વાર", "kn": "ದಿನಕ್ಕೆ ಮೂರು ಬಾರಿ", "ml": "ദിവസത്തിൽ മൂന്നുതവണ",
            "pa": "ਦਿਨ ਵਿੱਚ ਤਿੰਨ ਵਾਰ", "ur": "دن میں تین بار"
        },
        "at bedtime": {
            "hi": "सोने के समय", "bn": "ঘুমানোর সময়", "ta": "தூங்கும் போது", "te": "పడుకునే సమయంలో",
            "mr": "झोपताना", "gu": "સૂવાના સમયે", "kn": "ಮಲಗುವ ಸಮಯದಲ್ಲಿ", "ml": "ഉറങ്ങുന്ന സമയം",
            "pa": "ਸੌਣ ਸਮੇਂ", "ur": "سوتے وقت"
        }
    }

    for conn, trans_map in connectors.items():
        if target_lang in trans_map:
            pattern = re.compile(re.escape(conn), re.IGNORECASE)
            result = pattern.sub(trans_map[target_lang], result)

    return result

def translate_instructions_list(
    instructions: List[str],
    target_language: str,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """Batch-translates a list of clinical instruction lines."""
    results = []
    for inst in instructions:
        if not inst:
            continue
        res = translate_clinical_text(inst, target_language, db=db)
        results.append(res)
    return results
