/**
 * مِركاب | MIRKAB — ملف إدارة بيانات المنتجات والتصنيفات
 * --------------------------------------------------------------------------
 * مجلد الصور المستقل للمنتجات: ./assets/images/products/
 *
 * لإضافة منتج جديد أو تعديل منتج حالي:
 *   1. ضع الصورة الرئيسية والصور الإضافية داخل مجلد: assets/images/products/
 *   2. أضف عنصراً جديداً في مصفوفة PRODUCTS أو عدّل الحقول المطلوبة:
 *      - id: معرف فريد بالإنجليزية (مثال: 'dashcam-4k-pro')
 *      - category: أحد التصنيفات المعرفة في PRODUCT_CATEGORIES
 *      - status: 'published' للعرض في الموقع، أو 'draft' للإخفاء المؤقت دون حذف
 *      - order: رقم الترتيب التصاعدي في العرض
 *      - image: اسم ملف الصورة الرئيسية أو مسارها داخل assets/images/products/
 *      - gallery: مصفوفة أسماء أو مسارات الصور الإضافية (مثال: ['img-2.jpg', 'img-3.jpg'])
 *      - price: السعر المؤكد بالريال السعودي (مثال: '149 ر.س' أو 149)، أو '' عند عدم توفر سعر مؤكد
 *      - amazonUrl: رابط المنتج المباشر على Amazon.sa بصيغة HTTPS، أو '' عند عدم التوفر بعد
 *      - ar / en: الاسم (name)، الفائدة المختصرة (benefit)، الوصف (description)، المميزات (features)، والمواصفات (specs)
 */

export const PRODUCT_IMAGES_BASE_DIR = './assets/images/products/';

export const PRODUCT_CATEGORIES = [
  { id: 'tech', ar: 'تقنيات السيارات', en: 'Automotive Tech' },
  { id: 'emergency', ar: 'السلامة والطوارئ', en: 'Safety & Emergency' },
  { id: 'comfort', ar: 'الراحة والرفاهية', en: 'Comfort & Luxury' },
  { id: 'organization', ar: 'التنظيم والتخزين', en: 'Organization' },
  { id: 'power', ar: 'الكهرباء والطاقة', en: 'Power & Energy' },
  { id: 'care', ar: 'الصيانة والعناية', en: 'Maintenance & Care' }
];

/**
 * قالب مرجعي جاهز لنسخه عند إضافة منتج جديد أو ربط لوحة تحكم مستقبلاً.
 */
export const PRODUCT_SCHEMA_TEMPLATE = {
  id: '',
  category: 'tech',
  status: 'published',
  order: 99,
  image: '',
  gallery: [],
  price: '',
  amazonUrl: '',
  ar: {
    name: '',
    benefit: '',
    description: '',
    features: [],
    specs: []
  },
  en: {
    name: '',
    benefit: '',
    description: '',
    features: [],
    specs: []
  }
};

export const PRODUCTS = [
  {
    id: 'sunshade-thermal-shield',
    category: 'comfort',
    status: 'published',
    order: 1,
    image: './assets/images/products/prod-thermal-sunshade.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'مظلة العزل الحراري الذكية',
      benefit: 'تقلل حرارة المقصورة وتحمي الطبلون من الشمس.',
      description: 'مظلة للزجاج الأمامي بطبقة عاكسة للحرارة، تنطوي وتُفرد خلال ثوانٍ لحماية المقصورة والشاشات عند الركن.',
      features: [
        'طبقة عاكسة تقلل امتصاص الحرارة داخل المقصورة',
        'إطار مرن يسهل فتحه وطيّه داخل حقيبة تخزين مدمجة',
        'تركيب مباشر على الزجاج الأمامي دون حوامل لاصقة'
      ],
      specs: [
        { label: 'التصنيف', value: 'الراحة والوقاية من الشمس' },
        { label: 'الاستخدام', value: 'الزجاج الأمامي للمركبة' },
        { label: 'التخزين', value: 'قابل للطي في جيب الباب أو الصندوق' },
        { label: 'التركيب', value: 'فوري دون أدوات أو تثبيت دائم' }
      ]
    },
    en: {
      name: 'Thermal Reflective Windshield Shield',
      benefit: 'Keeps the parked cabin cooler and shields the dashboard.',
      description: 'Reflective windshield sunshade designed to deploy and fold cleanly in seconds to protect cabin surfaces and displays.',
      features: [
        'Heat-reflective surface lowers solar buildup on dash surfaces',
        'Flexible collapsible frame folds into a compact sleeve',
        'Installs directly behind the windshield without suction cups'
      ],
      specs: [
        { label: 'Category', value: 'Comfort & Solar Protection' },
        { label: 'Placement', value: 'Interior front windshield' },
        { label: 'Storage', value: 'Folds compactly for door or glovebox stowage' },
        { label: 'Setup', value: 'Tool-free instant placement' }
      ]
    }
  },
  {
    id: 'jump-starter-pack',
    category: 'power',
    status: 'published',
    order: 2,
    image: './assets/images/products/prod-jump-starter.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'جهاز تشغيل البطارية المحمول',
      benefit: 'يشغّل سيارتك ذاتياً عند نفاد البطارية خلال دقائق.',
      description: 'وحدة طاقة مدمجة مع ملاقط توصيل ذكية تمنحك القدرة على تشغيل السيارة في حالات ضعف البطارية دون سيارة مساعدة.',
      features: [
        'تشغيل ذاتي للمحرك في المواقف والطرق دون الاعتماد على الغير',
        'ملاقط معزولة مزودة بحماية من التوصيل العكسي',
        'مخرج طاقة احتياطي لشحن الأجهزة المحمولة في الطوارئ'
      ],
      specs: [
        { label: 'التصنيف', value: 'الكهرباء والطوارئ' },
        { label: 'الاستخدام', value: 'تشغيل بطاريات السيارات الضعيفة' },
        { label: 'السلامة', value: 'ملاقط ذكية معزولة ضد التماس العكسي' },
        { label: 'التخزين', value: 'حجم مدمج لصندوق القفازات أو الشنطة' }
      ]
    },
    en: {
      name: 'Compact Portable Jump Starter',
      benefit: 'Restarts a drained battery on your own within minutes.',
      description: 'Pocket-sized emergency battery booster paired with insulated smart clamps for self-reliant vehicle restarts.',
      features: [
        'Enables independent restarts without waiting for jumper cables',
        'Insulated clamps with reverse-polarity safeguard',
        'Doubles as an emergency USB reserve power source'
      ],
      specs: [
        { label: 'Category', value: 'Power & Roadside Recovery' },
        { label: 'Function', value: 'Vehicle battery emergency boost' },
        { label: 'Protection', value: 'Spark-proof smart clamp circuitry' },
        { label: 'Portability', value: 'Compact casing for glovebox storage' }
      ]
    }
  },
  {
    id: 'compact-dashcam',
    category: 'tech',
    status: 'published',
    order: 3,
    image: './assets/images/products/prod-dashcam.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'كاميرا داش كام للرؤية الليلية',
      benefit: 'توثّق الطريق بوضوح ليلاً ونهاراً دون حجب الرؤية.',
      description: 'كاميرا أمامية أسطوانية بتصميم مدمج يختفي خلف المرآة الوسطية لتوثيق القيادة اليومية والمواقف الطارئة.',
      features: [
        'تصميم نحيف يحافظ على اتساع مجال رؤية السائق',
        'حساس بصري مهيأ لالتقاط تفاصيل الطريق في الإضاءة المنخفضة',
        'تسجيل تلقائي متتابع مع حفظ المقاطع الحرجة'
      ],
      specs: [
        { label: 'التصنيف', value: 'تقنيات القيادة والسلامة' },
        { label: 'الموقع', value: 'أعلى الزجاج الأمامي خلف المرآة' },
        { label: 'الرؤية', value: 'توثيق نهاري وليلي مستمر' },
        { label: 'التشغيل', value: 'تلقائي مع تشغيل المركبة' }
      ]
    },
    en: {
      name: 'Low-Light Cylindrical Dashcam',
      benefit: 'Records clear day and night footage without blocking your view.',
      description: 'Stealth cylindrical dash camera engineered to tuck discreetly behind the rearview mirror for continuous road documentation.',
      features: [
        'Low-profile barrel body preserves clean windshield sightlines',
        'Optics tuned for evening and low-light roadway visibility',
        'Continuous loop recording with automatic incident locking'
      ],
      specs: [
        { label: 'Category', value: 'Automotive Tech' },
        { label: 'Mounting', value: 'Hidden mount behind rearview mirror' },
        { label: 'Capture', value: 'Day & low-light continuous loop' },
        { label: 'Operation', value: 'Automatic start with ignition' }
      ]
    }
  },
  {
    id: 'fast-pd-car-charger',
    category: 'power',
    status: 'published',
    order: 4,
    image: './assets/images/products/prod-fast-charger.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'شاحن سيارة معدني فائق السرعة',
      benefit: 'يشحن هاتفين بسرعة وثبات أثناء تشغيل الخرائط.',
      description: 'محول طاقة لمنفذ 12 فولت بهيكل معدني مدمج ومنافذ USB-C مزدوجة يوفر شحناً مستقراً للهواتف والأجهزة أثناء القيادة.',
      features: [
        'شحن متزامن لأكثر من جهاز بثبات أثناء استخدام تطبيقات الملاحة',
        'هيكل معدني يساعد على تبديد الحرارة في الأجواء الحارة',
        'تصميم مسطح يندمج بأناقة مع كونسول السيارة'
      ],
      specs: [
        { label: 'التصنيف', value: 'الطاقة والشحن' },
        { label: 'التوافق', value: 'منفذ ولاعة السيارة 12 فولت القياسي' },
        { label: 'المنافذ', value: 'منافذ USB-C سريعة مزدوجة' },
        { label: 'الهيكل', value: 'سبائك معدنية لتشتيت الحرارة' }
      ]
    },
    en: {
      name: 'Brushed Metal Dual-PD Car Charger',
      benefit: 'Fast-charges two devices steadily while navigating.',
      description: 'Flush-fit metallic 12V car adapter with dual USB-C ports built to maintain steady charging during GPS navigation.',
      features: [
        'Powers two phones concurrently without drops under navigation load',
        'Machined metal body promotes steady thermal dissipation',
        'Low-profile flush design integrates cleanly into the console'
      ],
      specs: [
        { label: 'Category', value: 'Power & Charging' },
        { label: 'Input', value: 'Standard 12V vehicle power socket' },
        { label: 'Ports', value: 'Dual high-speed USB-C outputs' },
        { label: 'Chassis', value: 'Heat-dissipating metal alloy body' }
      ]
    }
  },
  {
    id: 'tire-inflator-pro',
    category: 'emergency',
    status: 'published',
    order: 5,
    image: './assets/images/products/prod-tire-inflator.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'منفاخ هواء رقمي متنقل',
      benefit: 'يضبط ضغط الإطارات تلقائياً في دقائق أينما كنت.',
      description: 'ضاغط هواء لاسلكي بشاشة رقمية واضحة وإيقاف تلقائي عند الوصول للضغط المطلوب لمتابعة الإطارات دون الحاجة لمحطة الوقود.',
      features: [
        'قراءة رقمية دقيقة لضغط الإطار مع توقف تلقائي عند الحد المحدد',
        'إضاءة LED مدمجة لتسهيل التوصيل ليلاً على جانب الطريق',
        'حجم عملي يُحفظ بسهولة داخل الصندوق الخلفي'
      ],
      specs: [
        { label: 'التصنيف', value: 'السلامة والصيانة السريعة' },
        { label: 'التحكم', value: 'ضبط رقمي للضغط مع إيقاف تلقائي' },
        { label: 'الإضاءة', value: 'كشاف LED مدمج للاستخدام الليلي' },
        { label: 'التخزين', value: 'محمول ولاسلكي لحفظه في الصندوق' }
      ]
    },
    en: {
      name: 'Digital Cordless Tire Inflator',
      benefit: 'Tops up tire pressure accurately with automatic shut-off.',
      description: 'Cordless air compressor featuring a digital gauge and auto shut-off so you can maintain safe tire pressure anywhere.',
      features: [
        'Digital PSI display with automatic shut-off at target pressure',
        'Built-in LED work light for nighttime roadside adjustments',
        'Compact cordless form fits neatly in trunk storage'
      ],
      specs: [
        { label: 'Category', value: 'Safety & Roadside Readiness' },
        { label: 'Control', value: 'Preset digital gauge with auto-stop' },
        { label: 'Illumination', value: 'Integrated LED work light' },
        { label: 'Portability', value: 'Cordless compact cylinder body' }
      ]
    }
  },
  {
    id: 'trunk-storage-organizer',
    category: 'organization',
    status: 'published',
    order: 6,
    image: './assets/images/products/prod-trunk-organizer.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'منظم صندوق السيارة القابل للطي',
      benefit: 'يثبّت الأغراض وعدة الطوارئ داخل الصندوق دون فوضى.',
      description: 'صندوق تنظيم بجدران متينة وفواصل داخلية مرنة يمنع انزلاق المشتريات وأدوات السلامة داخل صندوق السيارة أثناء القيادة.',
      features: [
        'فواصل قابلة للتعديل تفصل عدة الطوارئ عن المشتريات اليومية',
        'ينطوي بالكامل بشكل مسطح عند الحاجة لكامل مساحة الصندوق',
        'قاعدة مستقرة تقلل حركة الأمتعة في المنعطفات'
      ],
      specs: [
        { label: 'التصنيف', value: 'التنظيم والتخزين' },
        { label: 'التصميم', value: 'جوانب متينة وقابلة للطي المسطح' },
        { label: 'التقسيم', value: 'أقسام متعددة بفواصل مرنة' },
        { label: 'الموقع', value: 'الصندوق الخلفي لجميع فئات السيارات' }
      ]
    },
    en: {
      name: 'Collapsible Cargo Trunk Organizer',
      benefit: 'Keeps trunk gear and groceries upright without rolling.',
      description: 'Structured storage organizer with adjustable interior dividers that prevents cargo from shifting across the trunk floor.',
      features: [
        'Adjustable compartments separate safety gear from daily errands',
        'Folds completely flat in seconds when full cargo room is needed',
        'Stable base keeps items upright through corners'
      ],
      specs: [
        { label: 'Category', value: 'Cabin & Trunk Organization' },
        { label: 'Structure', value: 'Rigid reinforced collapsible walls' },
        { label: 'Layout', value: 'Multi-compartment adjustable dividers' },
        { label: 'Fit', value: 'Universal rear trunk placement' }
      ]
    }
  },
  {
    id: 'magnetic-vent-mount',
    category: 'tech',
    status: 'published',
    order: 7,
    image: './assets/images/products/prod-phone-mount.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'حامل هاتف مغناطيسي ثابت',
      benefit: 'يثبّت الهاتف بمستوى نظرك بيد واحدة دون اهتزاز.',
      description: 'حامل معدني مدمج بتثبيت مغناطيسي قوي يضع الهاتف في زاوية رؤية مريحة دون حجب الزجاج الأمامي أو إرباك شكل المقصورة.',
      features: [
        'التقاط مغناطيسي فوري بيد واحدة لسهولة الصعود والنزول',
        'مفصل معدني محكم يقلل الاهتزاز على الطرق غير المستوية',
        'حجم أنيق ينسجم مع تصميم المقصورة الحديثة'
      ],
      specs: [
        { label: 'التصنيف', value: 'إكسسوارات القيادة الذكية' },
        { label: 'التثبيت', value: 'مغناطيسي فوري بمفصل تعديل الزاوية' },
        { label: 'البنية', value: 'سبائك معدنية مدمجة' },
        { label: 'التوافق', value: 'مناسب للهواتف الذكية أثناء الملاحة' }
      ]
    },
    en: {
      name: 'Precision Magnetic Cockpit Mount',
      benefit: 'Holds your phone steady at eye level with one-handed snap.',
      description: 'Compact alloy magnetic dock engineered to keep your phone cleanly positioned for navigation without obstructing the windshield.',
      features: [
        'Instant one-handed magnetic attachment and release',
        'Damped metal hinge minimizes vibration on uneven pavement',
        'Minimalist silhouette preserves cockpit aesthetics'
      ],
      specs: [
        { label: 'Category', value: 'Cockpit Tech' },
        { label: 'Mechanism', value: 'Quick-snap magnetic alignment' },
        { label: 'Build', value: 'Precision alloy housing' },
        { label: 'Use Case', value: 'Steady hands-free navigation' }
      ]
    }
  },
  {
    id: 'roadside-safety-kit',
    category: 'emergency',
    status: 'published',
    order: 8,
    image: './assets/images/products/prod-safety-kit.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'حقيبة الطوارئ والسلامة',
      benefit: 'تجمع أدوات التنبيه والإنقاذ الأساسية لسلامة الطريق.',
      description: 'طقم سلامة منظم يضم مثلث التحذير العاكس وأداة الإنقاذ المزدوجة في حافظة واحدة جاهزة دائماً للتوقف الاضطراري.',
      features: [
        'مثلث تحذير عاكس واضح لتنبيه المركبات القادمة عند التوقف',
        'أداة مدمجة لكسر الزجاج وقص حزام الأمان في الحالات الحرجة',
        'حافظة مضغوطة تحفظ الأدوات مرتبة وفي متناول اليد'
      ],
      specs: [
        { label: 'التصنيف', value: 'السلامة والطوارئ' },
        { label: 'المحتويات', value: 'مثلث تنبيه عاكس + أداة طوارئ مزدوجة' },
        { label: 'التعبئة', value: 'حافظة منظمة بسحّاب متين' },
        { label: 'الغرض', value: 'التوقف الطارئ على الطرق السريعة' }
      ]
    },
    en: {
      name: 'Compact Roadside Emergency Kit',
      benefit: 'Packs essential warning and rescue gear for roadside stops.',
      description: 'Organized safety kit combining a high-visibility warning triangle and dual escape tool in one structured case.',
      features: [
        'Reflective warning triangle alerts approaching traffic clearly',
        'Integrated seatbelt cutter and emergency window breaker tool',
        'Hard zippered case keeps essential tools organized'
      ],
      specs: [
        { label: 'Category', value: 'Safety & Emergency' },
        { label: 'Contents', value: 'Reflective triangle & dual rescue tool' },
        { label: 'Housing', value: 'Structured zippered carrying case' },
        { label: 'Purpose', value: 'Highway breakdown readiness' }
      ]
    }
  },
  {
    id: 'cordless-car-vacuum',
    category: 'care',
    status: 'published',
    order: 9,
    image: './assets/images/products/prod-car-vacuum.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'مكنسة سيارة لاسلكية',
      benefit: 'تنظّف الرمال والغبار من الزوايا الضيقة في دقائق.',
      description: 'مكنسة محمولة خفيفة الوزن مزودة بفوهات دقيقة للوصول إلى بين المقاعد وفتحات التكييف دون أسلاك مقيدة.',
      features: [
        'حرية حركة كاملة دون سلك طويل داخل المقصورة',
        'فوهات مخصصة لشفط الغبار من مجاري المقاعد والكونسول',
        'وزن خفيف يتيح التنظيف السريع في أي وقت'
      ],
      specs: [
        { label: 'التصنيف', value: 'الصيانة والعناية بالمقصورة' },
        { label: 'التشغيل', value: 'لاسلكي محمول' },
        { label: 'الملحقات', value: 'رؤوس رفيعة للزوايا وفتحات التكييف' },
        { label: 'الاستخدام', value: 'إزالة الغبار والرمال اليومية' }
      ]
    },
    en: {
      name: 'Cordless Cabin Mini Vacuum',
      benefit: 'Clears sand and dust from tight seat crevices quickly.',
      description: 'Lightweight cordless handheld vacuum equipped with narrow nozzle tips for quick cleanups around seat rails and vents.',
      features: [
        'Cable-free reach across front, rear seats, and floor mats',
        'Crevice nozzles reach narrow gaps between console and seats',
        'Lightweight form factor built for quick daily maintenance'
      ],
      specs: [
        { label: 'Category', value: 'Maintenance & Care' },
        { label: 'Power', value: 'Cordless rechargeable operation' },
        { label: 'Nozzles', value: 'Precision crevice and vent attachments' },
        { label: 'Use Case', value: 'Quick interior sand & dust removal' }
      ]
    }
  },
  {
    id: 'interior-detailing-set',
    category: 'care',
    status: 'published',
    order: 10,
    image: './assets/images/products/prod-interior-care.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'طقم العناية السريعة بالمقصورة',
      benefit: 'يعيد للداخلية نظافتها المطفية دون لمعان دهني.',
      description: 'مجموعة تنظيف سريعة تضم منظف أسطح غير لامع مع منشفة مايكروفايبر فائقة النعومة لإزالة البصمات والغبار بأمان.',
      features: [
        'يمنح الديكور الداخلي مظهراً نظيفاً غير عاكس تحت الشمس',
        'منشفة مايكروفايبر ناعمة آمنة على شاشات اللمس والبيانو بلاك',
        'روتين عناية سريع يستعيد رونق المقصورة في دقيقتين'
      ],
      specs: [
        { label: 'التصنيف', value: 'العناية الداخلية' },
        { label: 'التشطيب', value: 'مطفي طبيعي دون أثر دهني' },
        { label: 'الأسطح', value: 'الطبلون، الشاشات، والأسطح الداخلية' },
        { label: 'المرفقات', value: 'عبوة منظف + منشفة مايكروفايبر' }
      ]
    },
    en: {
      name: 'Matte Interior Detailing Kit',
      benefit: 'Refreshes cockpit trim and screens with a clean matte finish.',
      description: 'Quick-refresh detailing duo pairing a non-greasy surface mist with a plush microfiber towel for dust and smudges.',
      features: [
        'Restores an OEM matte look with zero distracting glare',
        'Ultra-plush microfiber safe for infotainment displays',
        'Fast two-minute wipe-down keeps cabin materials crisp'
      ],
      specs: [
        { label: 'Category', value: 'Interior Detailing' },
        { label: 'Finish', value: 'Non-greasy factory matte' },
        { label: 'Surfaces', value: 'Dashboard, screens, and trim' },
        { label: 'Included', value: 'Surface cleaner + microfiber cloth' }
      ]
    }
  },
  {
    id: 'reflective-safety-vest-kit',
    category: 'emergency',
    status: 'published',
    order: 11,
    image: './assets/images/products/prod-safety-vest.jpg',
    gallery: [],
    price: '',
    amazonUrl: '',
    ar: {
      name: 'أداة أمان المقصورة والسترة العاكسة',
      benefit: 'تمنحك رؤية آمنة ليلاً مع أداة طوارئ في متناول يدك.',
      description: 'سترة سلامة عاكسة قابلة للطي مرفقة بأداة طوارئ معدنية للتخزين القريب داخل جيب الباب عند التوقف الليلي.',
      features: [
        'أشرطة عاكسة واضحة تبرز موقع السائق من مسافة آمنة ليلاً',
        'أداة طوارئ معدنية جاهزة داخل جيب الباب بجانب السائق',
        'حجم مطوي مسطح لا يشغل حيزاً في المقصورة'
      ],
      specs: [
        { label: 'التصنيف', value: 'السلامة والرؤية الليلية' },
        { label: 'المحتويات', value: 'سترة عاكسة + أداة طوارئ معدنية' },
        { label: 'التخزين', value: 'حجم مسطح يناسب جيب الباب الأمامي' },
        { label: 'الاستخدام', value: 'النزول الآمن والتعامل السريع ليلاً' }
      ]
    },
    en: {
      name: 'High-Vis Vest & Cabin Rescue Tool',
      benefit: 'Boosts nighttime visibility with an easy-reach rescue tool.',
      description: 'Compact reflective safety vest paired with an anodized cabin rescue tool tailored for driver door-pocket storage.',
      features: [
        'High-visibility reflective bands catch oncoming headlights early',
        'Anodized rescue tool stays within arm’s reach in the cabin',
        'Slim folded profile fits neatly in front door pockets'
      ],
      specs: [
        { label: 'Category', value: 'Safety & Night Visibility' },
        { label: 'Included', value: 'Reflective safety vest + rescue tool' },
        { label: 'Storage', value: 'Flat-fold profile for door pockets' },
        { label: 'Purpose', value: 'Safe roadside visibility at night' }
      ]
    }
  }
];
