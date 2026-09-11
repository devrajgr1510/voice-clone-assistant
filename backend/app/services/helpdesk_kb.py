"""
Rule-based, fully local help-desk assistant.

HONESTY NOTE: this is a keyword/topic-matching FAQ engine, not a general
LLM. It works fully offline (no external API key, no network call) which
keeps it free to run and deployable anywhere, but it can only answer the
questions it has been taught — see TOPICS below. Anything it doesn't
recognize gets an honest "I don't have an answer for that yet" fallback
plus a suggestion to check Settings / contact a human admin, rather than
inventing an answer.

Multi-language: each topic has short, hand-written answers for a set of
widely-spoken languages. If a user's selected language isn't covered for
a topic yet, the assistant falls back to English and says so, instead of
silently mistranslating.
"""
import re
import uuid
from typing import Dict, List, Optional, Tuple

SUPPORTED_LANGS = ["en", "hi", "kn", "ta", "te", "ml", "bn", "mr", "gu", "es", "fr", "ar", "zh"]

# Each topic: id -> { keywords: [...], answers: {lang: text} }
TOPICS: Dict[str, Dict] = {
    "what_is_app": {
        "keywords": ["what is this app", "what does this app do", "about vaanee", "what is vaanee",
                     "purpose", "what does this do"],
        "answers": {
            "en": "VAANEE SHIELD analyzes phone calls in real time to flag AI-generated / cloned "
                  "voices and voice impersonation attempts, so you can catch scam or fraud calls "
                  "before they cause harm.",
            "hi": "VAANEE SHIELD कॉल्स का वास्तविक समय में विश्लेषण करता है ताकि AI-जनित या नकली "
                  "आवाज़ों और पहचान की नकल का पता लगाया जा सके, जिससे धोखाधड़ी वाली कॉल से बचा जा सके।",
            "kn": "VAANEE SHIELD ಕರೆಗಳನ್ನು ನೈಜ ಸಮಯದಲ್ಲಿ ವಿಶ್ಲೇಷಿಸಿ AI-ಸೃಷ್ಟಿತ ಅಥವಾ ನಕಲಿ ಧ್ವನಿಗಳನ್ನು "
                  "ಗುರುತಿಸುತ್ತದೆ, ಇದರಿಂದ ವಂಚನೆ ಕರೆಗಳಿಂದ ರಕ್ಷಣೆ ಪಡೆಯಬಹುದು.",
            "ta": "VAANEE SHIELD அழைப்புகளை நேரடியாக ஆய்வு செய்து AI உருவாக்கிய அல்லது போலியான "
                  "குரல்களை கண்டறிகிறது, இதன் மூலம் மோசடி அழைப்புகளை தடுக்கலாம்.",
            "te": "VAANEE SHIELD కాల్స్‌ను రియల్ టైమ్‌లో విశ్లేషించి AI-సృష్టించిన లేదా నకిలీ స్వరాలను "
                  "గుర్తిస్తుంది, తద్వారా మోసపూరిత కాల్స్ నుండి రక్షణ లభిస్తుంది.",
            "es": "VAANEE SHIELD analiza llamadas en tiempo real para detectar voces generadas por "
                  "IA o clonadas y así prevenir fraudes telefónicos.",
            "fr": "VAANEE SHIELD analyse les appels en temps réel pour détecter les voix générées "
                  "par IA ou clonées et prévenir les appels frauduleux.",
            "ar": "يقوم VAANEE SHIELD بتحليل المكالمات في الوقت الفعلي للكشف عن الأصوات المستنسخة "
                  "أو المولدة بالذكاء الاصطناعي للمساعدة في منع مكالمات الاحتيال.",
            "zh": "VAANEE SHIELD 实时分析通话，识别人工智能生成或克隆的声音，帮助您在受骗前发现诈骗电话。",
        },
    },
    "how_risk_score": {
        "keywords": ["risk score", "how is risk calculated", "how does scoring work", "what does score mean"],
        "answers": {
            "en": "The risk score (0-100) blends six signals: synthetic-voice likelihood, speaker "
                  "mismatch, prosody anomaly, acoustic anomaly, context risk, and transaction risk. "
                  "0-29 is Low, 30-59 Medium, 60-79 High, 80-100 Critical.",
            "hi": "जोखिम स्कोर (0-100) छह संकेतों से बनता है: सिंथेटिक आवाज़ की संभावना, स्पीकर बेमेल, "
                  "प्रोसोडी विसंगति, ध्वनिक विसंगति, संदर्भ जोखिम और लेनदेन जोखिम। 0-29 कम, 30-59 "
                  "मध्यम, 60-79 उच्च, 80-100 गंभीर है।",
            "kn": "ಅಪಾಯ ಅಂಕ (0-100) ಆರು ಸಂಕೇತಗಳ ಮಿಶ್ರಣ: ಕೃತಕ ಧ್ವನಿ ಸಾಧ್ಯತೆ, ಸ್ಪೀಕರ್ ಹೊಂದಾಣಿಕೆ ಇಲ್ಲದಿರುವಿಕೆ, "
                  "ಪ್ರಾಸೋಡಿ, ಧ್ವನಿ ಅಸಹಜತೆ, ಸಂದರ್ಭ ಮತ್ತು ವಹಿವಾಟು ಅಪಾಯ. 0-29 ಕಡಿಮೆ, 30-59 ಮಧ್ಯಮ, 60-79 "
                  "ಹೆಚ್ಚು, 80-100 ತೀವ್ರ.",
            "ta": "ஆபத்து மதிப்பெண் (0-100) ஆறு காரணிகளை இணைக்கிறது: செயற்கைக் குரல் வாய்ப்பு, பேச்சாளர் "
                  "பொருந்தாமை, தாள வேறுபாடு, ஒலி வேறுபாடு, சூழல் மற்றும் பரிவர்த்தனை ஆபத்து. 0-29 குறைவு, "
                  "30-59 நடுத்தரம், 60-79 அதிகம், 80-100 மிக முக்கியமானது.",
            "te": "రిస్క్ స్కోర్ (0-100) ఆరు సంకేతాలను మిళితం చేస్తుంది: సింథటిక్ వాయిస్ అవకాశం, స్పీకర్ "
                  "అసమతుల్యత, ప్రోసోడీ అసాధారణత, ధ్వని అసాధారణత, సందర్భ మరియు లావాదేవీ రిస్క్. 0-29 తక్కువ, "
                  "30-59 మధ్యస్థం, 60-79 అధికం, 80-100 తీవ్రమైనది.",
            "es": "La puntuación de riesgo (0-100) combina seis señales: voz sintética, discrepancia "
                  "de hablante, anomalía prosódica, anomalía acústica, riesgo de contexto y riesgo de "
                  "transacción. 0-29 Bajo, 30-59 Medio, 60-79 Alto, 80-100 Crítico.",
            "fr": "Le score de risque (0-100) combine six signaux : probabilité de voix synthétique, "
                  "incohérence du locuteur, anomalie prosodique, anomalie acoustique, risque "
                  "contextuel et risque de transaction. 0-29 Faible, 30-59 Moyen, 60-79 Élevé, "
                  "80-100 Critique.",
            "ar": "تجمع درجة الخطورة (0-100) بين ستة إشارات: احتمال الصوت الاصطناعي، عدم تطابق "
                  "المتحدث، شذوذ النبرة، شذوذ صوتي، خطر السياق وخطر المعاملة. 0-29 منخفض، 30-59 "
                  "متوسط، 60-79 مرتفع، 80-100 حرج.",
            "zh": "风险评分（0-100）综合六个信号：合成语音可能性、说话人不匹配、韵律异常、声学异常、"
                  "情境风险和交易风险。0-29为低，30-59为中，60-79为高，80-100为严重。",
        },
    },
    "block_number": {
        "keywords": ["block a number", "how to block", "unblock", "blocked numbers"],
        "answers": {
            "en": "Go to Live Protection or Call History and tap \"Block Call Automatically\" on a "
                  "flagged call, or ask an admin to add the number under Admin Panel > Blocked "
                  "Numbers. Note: a web app can mark a number blocked in-app, but stopping it from "
                  "ringing your phone at the OS level needs a native Android call-screening app.",
            "hi": "Live Protection या Call History में जाकर फ्लैग की गई कॉल पर \"Block Call "
                  "Automatically\" दबाएँ, या एडमिन से Admin Panel > Blocked Numbers में नंबर जोड़ने "
                  "को कहें। ध्यान दें: वेब ऐप नंबर को ऐप में ब्लॉक कर सकता है, पर फोन पर रिंग होने से "
                  "रोकने के लिए नेटिव Android कॉल-स्क्रीनिंग ऐप चाहिए।",
            "kn": "Live Protection ಅಥವಾ Call History ಗೆ ಹೋಗಿ ಫ್ಲ್ಯಾಗ್ ಆದ ಕರೆಯಲ್ಲಿ \"Block Call "
                  "Automatically\" ಒತ್ತಿ, ಅಥವಾ ಅಡ್ಮಿನ್‌ ಪ್ಯಾನೆಲ್‌ನಲ್ಲಿ ಸಂಖ್ಯೆಯನ್ನು ಸೇರಿಸಲು ಅಡ್ಮಿನ್ ಅನ್ನು ಕೇಳಿ.",
            "ta": "Live Protection அல்லது Call History-க்குச் சென்று கொடி காட்டப்பட்ட அழைப்பில் \"Block "
                  "Call Automatically\" ஐ தட்டவும், அல்லது Admin Panel > Blocked Numbers-ல் சேர்க்க "
                  "நிர்வாகியிடம் கேளுங்கள்.",
            "te": "Live Protection లేదా Call History కి వెళ్లి ఫ్లాగ్ చేసిన కాల్‌పై \"Block Call "
                  "Automatically\" నొక్కండి, లేదా Admin Panel > Blocked Numbers లో జోడించమని అడ్మిన్‌ను "
                  "అడగండి.",
            "es": "Ve a Live Protection o Call History y toca \"Block Call Automatically\" en una "
                  "llamada marcada, o pide a un administrador que añada el número en Admin Panel > "
                  "Blocked Numbers.",
            "fr": "Allez dans Live Protection ou Call History et appuyez sur \"Block Call "
                  "Automatically\" sur un appel signalé, ou demandez à un administrateur d'ajouter "
                  "le numéro dans Admin Panel > Blocked Numbers.",
            "ar": "انتقل إلى Live Protection أو Call History واضغط على \"Block Call Automatically\" "
                  "على مكالمة مُعلَّمة، أو اطلب من المسؤول إضافة الرقم ضمن Admin Panel > Blocked "
                  "Numbers.",
            "zh": "前往 Live Protection 或 Call History，在被标记的通话上点击\"Block Call "
                  "Automatically\"，或请管理员在 Admin Panel > Blocked Numbers 中添加该号码。",
        },
    },
    "voice_model_real": {
        "keywords": ["is the ai real", "trained model", "is this a real ai", "how accurate",
                     "real detector", "fake detector"],
        "answers": {
            "en": "The built-in detector runs real signal-processing analysis (pitch/jitter, "
                  "shimmer, spectral flatness) on the actual audio you give it — it's a genuine "
                  "heuristic, not random numbers. But it is NOT a trained neural network like "
                  "AASIST or ECAPA-TDNN, because that needs a licensed genuine-vs-AI-voice dataset "
                  "and GPU training this environment doesn't have. Treat scores as useful signals, "
                  "not a certified verdict.",
            "hi": "यह डिटेक्टर वास्तविक ऑडियो पर सिग्नल-प्रोसेसिंग विश्लेषण (पिच, जिटर, शिमर, स्पेक्ट्रल "
                  "फ्लैटनेस) करता है — यह असली विश्लेषण है, यादृच्छिक संख्या नहीं। पर यह AASIST या "
                  "ECAPA-TDNN जैसा प्रशिक्षित न्यूरल नेटवर्क नहीं है, क्योंकि उसके लिए डेटा-सेट और GPU "
                  "प्रशिक्षण चाहिए जो यहाँ उपलब्ध नहीं है।",
            "kn": "ಈ ಡಿಟೆಕ್ಟರ್ ನಿಜವಾದ ಆಡಿಯೋದ ಮೇಲೆ ಸಿಗ್ನಲ್-ಪ್ರೊಸೆಸಿಂಗ್ ವಿಶ್ಲೇಷಣೆ (ಪಿಚ್, ಜಿಟರ್, ಸ್ಪೆಕ್ಟ್ರಲ್ "
                  "ಫ್ಲ್ಯಾಟ್‌ನೆಸ್) ಮಾಡುತ್ತದೆ — ಇದು ನಿಜವಾದ ವಿಶ್ಲೇಷಣೆ, ಆದರೆ AASIST/ECAPA-TDNN ನಂತಹ "
                  "ತರಬೇತಿ ಪಡೆದ ನ್ಯೂರಲ್ ಮಾಡೆಲ್ ಅಲ್ಲ.",
            "ta": "இந்த டிடெக்டர் உண்மையான ஆடியோவில் சிக்னல்-ப்ராசெசிங் பகுப்பாய்வு (பிட்ச், ஜிட்டர், "
                  "ஸ்பெக்ட்ரல் ஃப்ளாட்னெஸ்) செய்கிறது — இது உண்மையான பகுப்பாய்வு, ஆனால் AASIST/ECAPA-TDNN "
                  "போன்ற பயிற்சி பெற்ற நியூரல் மாடல் அல்ல.",
            "te": "ఈ డిటెక్టర్ నిజమైన ఆడియోపై సిగ్నల్-ప్రాసెసింగ్ విశ్లేషణ (పిచ్, జిట్టర్, స్పెక్ట్రల్ "
                  "ఫ్లాట్‌నెస్) చేస్తుంది — ఇది నిజమైన విశ్లేషణ, కానీ AASIST/ECAPA-TDNN వంటి శిక్షణ పొందిన "
                  "న్యూరల్ మోడల్ కాదు.",
            "es": "El detector realiza un análisis real de procesamiento de señales (tono, jitter, "
                  "shimmer, planitud espectral) sobre el audio real — es heurístico genuino, no "
                  "números aleatorios. Pero no es una red neuronal entrenada como AASIST o "
                  "ECAPA-TDNN.",
            "fr": "Le détecteur effectue une véritable analyse du signal (hauteur, jitter, shimmer, "
                  "planéité spectrale) sur l'audio réel — c'est une heuristique authentique, pas des "
                  "nombres aléatoires. Mais ce n'est pas un réseau de neurones entraîné comme AASIST "
                  "ou ECAPA-TDNN.",
            "ar": "يقوم الكاشف بتحليل إشارة حقيقي (النبرة، الاهتزاز، التسطح الطيفي) على الصوت الفعلي "
                  "— وهذا تحليل حقيقي وليس أرقامًا عشوائية. لكنه ليس شبكة عصبية مدربة مثل AASIST أو "
                  "ECAPA-TDNN.",
            "zh": "该检测器对真实音频进行真正的信号处理分析（基频、抖动、闪烁、频谱平坦度）——这是真实的启发式"
                  "分析，而非随机数字。但它不是像 AASIST 或 ECAPA-TDNN 那样经过训练的神经网络模型。",
        },
    },
    "add_speaker": {
        "keywords": ["add speaker", "enroll", "register a speaker", "new employee voice"],
        "answers": {
            "en": "Go to Speakers > Add Speaker, fill in their details, then record 2-3 voice "
                  "samples from the Voice Studio panel so future calls can be matched against a "
                  "verified voice print.",
            "hi": "Speakers > Add Speaker पर जाएँ, विवरण भरें, फिर Voice Studio पैनल से 2-3 आवाज़ के "
                  "नमूने रिकॉर्ड करें ताकि भविष्य की कॉल्स को सत्यापित आवाज़ से मिलान किया जा सके।",
            "kn": "Speakers > Add Speaker ಗೆ ಹೋಗಿ ವಿವರಗಳನ್ನು ಭರ್ತಿ ಮಾಡಿ, ನಂತರ Voice Studio ಪ್ಯಾನೆಲ್‌ನಿಂದ "
                  "2-3 ಧ್ವನಿ ಮಾದರಿಗಳನ್ನು ರೆಕಾರ್ಡ್ ಮಾಡಿ.",
            "ta": "Speakers > Add Speaker-க்குச் சென்று விவரங்களை நிரப்பவும், பின் Voice Studio "
                  "பேனலில் இருந்து 2-3 குரல் மாதிரிகளை பதிவு செய்யவும்.",
            "te": "Speakers > Add Speaker కి వెళ్లి వివరాలు నింపండి, తర్వాత Voice Studio ప్యానెల్ నుండి "
                  "2-3 వాయిస్ నమూనాలను రికార్డ్ చేయండి.",
            "es": "Ve a Speakers > Add Speaker, completa los datos y graba 2-3 muestras de voz desde "
                  "el panel Voice Studio.",
            "fr": "Allez dans Speakers > Add Speaker, remplissez les informations, puis "
                  "enregistrez 2-3 échantillons vocaux depuis le panneau Voice Studio.",
            "ar": "اذهب إلى Speakers > Add Speaker، واملأ التفاصيل، ثم سجّل 2-3 عينات صوتية من لوحة "
                  "Voice Studio.",
            "zh": "前往 Speakers > Add Speaker，填写详细信息，然后在 Voice Studio 面板中录制 2-3 段语音样本。",
        },
    },
    "admin_login": {
        "keywords": ["admin panel", "admin login", "how to login as admin", "default admin"],
        "answers": {
            "en": "Open Admin Login from the sidebar/menu. The README lists the default admin "
                  "credentials created on first run — change that password immediately after your "
                  "first login from Admin Panel > Admins.",
            "hi": "साइडबार/मेनू से Admin Login खोलें। पहली बार चलाने पर बनाए गए डिफ़ॉल्ट एडमिन क्रेडेंशियल "
                  "README में हैं — पहली लॉगिन के बाद तुरंत पासवर्ड बदलें।",
            "kn": "ಸೈಡ್‌ಬಾರ್/ಮೆನುವಿನಿಂದ Admin Login ತೆರೆಯಿರಿ. ಮೊದಲ ಬಾರಿಗೆ ರನ್ ಮಾಡಿದಾಗ ರಚಿಸಲಾದ ಡೀಫಾಲ್ಟ್ "
                  "ಎಡ್ಮಿನ್ ಕ್ರೆಡೆನ್ಷಿಯಲ್‌ಗಳು README ನಲ್ಲಿವೆ.",
            "ta": "பக்கப்பட்டி/மெனுவிலிருந்து Admin Login-ஐ திறக்கவும். முதல் இயக்கத்தில் உருவாக்கப்பட்ட "
                  "இயல்புநிலை நிர்வாக சான்றுகள் README-ல் உள்ளன.",
            "te": "సైడ్‌బార్/మెనూ నుండి Admin Login తెరవండి. మొదటి రన్‌లో సృష్టించబడిన డిఫాల్ట్ అడ్మిన్ "
                  "క్రెడెన్షియల్స్ README లో ఉన్నాయి.",
            "es": "Abre Admin Login desde el menú lateral. El README indica las credenciales de "
                  "administrador predeterminadas creadas en el primer arranque.",
            "fr": "Ouvrez Admin Login depuis le menu latéral. Le README indique les identifiants "
                  "administrateur par défaut créés au premier lancement.",
            "ar": "افتح Admin Login من القائمة الجانبية. يحتوي ملف README على بيانات اعتماد المسؤول "
                  "الافتراضية التي يتم إنشاؤها عند أول تشغيل.",
            "zh": "从侧边栏菜单打开 Admin Login。README 中列出了首次运行时创建的默认管理员凭据。",
        },
    },
    "location": {
        "keywords": ["location", "gps", "geolocation", "latitude longitude"],
        "answers": {
            "en": "The Location page uses your browser's Geolocation API (with your permission) to "
                  "show live latitude/longitude and a best-effort region lookup during a call — it "
                  "only works if you allow location access when prompted.",
            "hi": "Location पेज आपकी अनुमति से ब्राउज़र के Geolocation API का उपयोग करके लाइव "
                  "अक्षांश/देशांतर दिखाता है — यह तभी काम करता है जब आप स्थान की अनुमति देते हैं।",
            "kn": "Location ಪುಟವು ನಿಮ್ಮ ಅನುಮತಿಯೊಂದಿಗೆ ಬ್ರೌಸರ್‌ನ Geolocation API ಬಳಸಿ ಲೈವ್ "
                  "ಅಕ್ಷಾಂಶ/ರೇಖಾಂಶವನ್ನು ತೋರಿಸುತ್ತದೆ.",
            "ta": "Location பக்கம் உங்கள் அனுமதியுடன் உலாவியின் Geolocation API ஐப் பயன்படுத்தி நேரடி "
                  "அட்சரேகை/தீர்க்கரேகையைக் காட்டுகிறது.",
            "te": "Location పేజీ మీ అనుమతితో బ్రౌజర్ Geolocation API ఉపయోగించి లైవ్ అక్షాంశం/రేఖాంశాన్ని "
                  "చూపుతుంది.",
            "es": "La página Location usa la API de Geolocalización del navegador (con tu permiso) "
                  "para mostrar latitud/longitud en vivo durante una llamada.",
            "fr": "La page Location utilise l'API de géolocalisation du navigateur (avec votre "
                  "autorisation) pour afficher la latitude/longitude en direct.",
            "ar": "تستخدم صفحة Location واجهة تحديد الموقع الجغرافي للمتصفح (بإذنك) لعرض خط "
                  "العرض/الطول المباشر أثناء المكالمة.",
            "zh": "Location 页面在获得您许可后使用浏览器的地理位置 API，在通话期间显示实时经纬度。",
        },
    },
    "greeting": {
        "keywords": ["hi", "hello", "hey", "namaste", "vanakkam"],
        "answers": {
            "en": "Hi! I'm the VAANEE SHIELD help desk. Ask me about risk scores, blocking numbers, "
                  "voice detection, adding speakers, the admin panel, or location tracking.",
            "hi": "नमस्ते! मैं VAANEE SHIELD हेल्प डेस्क हूँ। मुझसे जोखिम स्कोर, नंबर ब्लॉक करना, आवाज़ "
                  "पहचान, स्पीकर जोड़ना, एडमिन पैनल, या लोकेशन के बारे में पूछें।",
            "kn": "ನಮಸ್ಕಾರ! ನಾನು VAANEE SHIELD ಸಹಾಯ ಕೇಂದ್ರ. ಅಪಾಯ ಅಂಕ, ಸಂಖ್ಯೆ ನಿರ್ಬಂಧ, ಧ್ವನಿ ಪತ್ತೆ, "
                  "ಸ್ಪೀಕರ್ ಸೇರ್ಪಡೆ, ಅಡ್ಮಿನ್ ಪ್ಯಾನಲ್ ಬಗ್ಗೆ ಕೇಳಿ.",
            "ta": "வணக்கம்! நான் VAANEE SHIELD உதவி மையம். ஆபத்து மதிப்பெண், எண் தடுப்பு, குரல் கண்டறிதல், "
                  "பேச்சாளர் சேர்த்தல், நிர்வாக பலகை பற்றி கேளுங்கள்.",
            "te": "నమస్తే! నేను VAANEE SHIELD హెల్ప్ డెస్క్. రిస్క్ స్కోర్, నంబర్ బ్లాకింగ్, వాయిస్ "
                  "డిటెక్షన్, స్పీకర్ జోడింపు, అడ్మిన్ ప్యానెల్ గురించి అడగండి.",
            "es": "¡Hola! Soy el servicio de ayuda de VAANEE SHIELD. Pregúntame sobre puntuaciones "
                  "de riesgo, bloqueo de números, detección de voz, o el panel de administración.",
            "fr": "Bonjour ! Je suis le service d'assistance VAANEE SHIELD. Posez-moi des questions "
                  "sur les scores de risque, le blocage de numéros, la détection vocale, etc.",
            "ar": "مرحبًا! أنا مكتب مساعدة VAANEE SHIELD. اسألني عن درجات الخطورة، حظر الأرقام، كشف "
                  "الصوت، أو لوحة الإدارة.",
            "zh": "你好！我是 VAANEE SHIELD 帮助台。可以问我关于风险评分、号码拦截、语音检测、添加说话人或"
                  "管理面板的问题。",
        },
    },
}

FALLBACK = {
    "en": "I don't have a specific answer for that yet. Try asking about risk scores, blocking a "
          "number, voice detection accuracy, adding a speaker, the admin panel, or location "
          "tracking — or contact your admin for anything account-specific.",
    "hi": "मेरे पास इसका विशिष्ट उत्तर अभी नहीं है। जोखिम स्कोर, नंबर ब्लॉक करना, आवाज़ पहचान, स्पीकर "
          "जोड़ना, एडमिन पैनल या लोकेशन के बारे में पूछें।",
    "kn": "ಇದಕ್ಕೆ ನಿರ್ದಿಷ್ಟ ಉತ್ತರ ನನ್ನ ಬಳಿ ಇಲ್ಲ. ಅಪಾಯ ಅಂಕ, ಸಂಖ್ಯೆ ನಿರ್ಬಂಧ, ಧ್ವನಿ ಪತ್ತೆ, ಅಥವಾ ಅಡ್ಮಿನ್ "
          "ಪ್ಯಾನಲ್ ಬಗ್ಗೆ ಕೇಳಿ ನೋಡಿ.",
    "ta": "இதற்கு குறிப்பிட்ட பதில் இப்போது என்னிடம் இல்லை. ஆபத்து மதிப்பெண், எண் தடுப்பு, குரல் "
          "கண்டறிதல் அல்லது நிர்வாக பலகை பற்றி கேளுங்கள்.",
    "te": "దీనికి నిర్దిష్ట సమాధానం నా వద్ద లేదు. రిస్క్ స్కోర్, నంబర్ బ్లాకింగ్, వాయిస్ డిటెక్షన్ లేదా "
          "అడ్మిన్ ప్యానెల్ గురించి అడగండి.",
    "es": "Aún no tengo una respuesta específica para eso. Pregunta sobre puntuaciones de riesgo, "
          "bloqueo de números, detección de voz o el panel de administración.",
    "fr": "Je n'ai pas encore de réponse précise à cela. Posez une question sur les scores de "
          "risque, le blocage de numéros, la détection vocale ou le panneau d'administration.",
    "ar": "ليس لدي إجابة محددة على ذلك بعد. اسأل عن درجات الخطورة، حظر الأرقام، كشف الصوت، أو لوحة "
          "الإدارة.",
    "zh": "我暂时没有具体答案。可以问我关于风险评分、号码拦截、语音检测或管理面板的问题。",
}


def _normalize(text: str) -> str:
    return re.sub(r"[^\w\s]", " ", text.lower()).strip()


def match_topic(message: str) -> Optional[str]:
    norm = _normalize(message)
    best_topic, best_hits = None, 0
    for topic_id, topic in TOPICS.items():
        hits = sum(1 for kw in topic["keywords"] if kw in norm)
        if hits > best_hits:
            best_hits, best_topic = hits, topic_id
    return best_topic


def answer(message: str, language: str = "en") -> Tuple[str, Optional[str], bool]:
    """Returns (answer_text, matched_topic_id, used_fallback_language)."""
    lang = language if language in SUPPORTED_LANGS else "en"
    topic_id = match_topic(message)
    if not topic_id:
        return FALLBACK.get(lang, FALLBACK["en"]), None, lang != language

    topic = TOPICS[topic_id]
    if lang in topic["answers"]:
        return topic["answers"][lang], topic_id, False
    return topic["answers"]["en"], topic_id, True


def new_session_id() -> str:
    return str(uuid.uuid4())
