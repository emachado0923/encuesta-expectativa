/**
 * Encuesta de expectativas de estudiantes de grado 11.
 *
 * Única fuente de verdad del cuestionario: el navegador dibuja lo que hay aquí y
 * la función del servidor valida contra lo mismo. Cambiar una pregunta es
 * editar este archivo; si cambian preguntas u opciones, hay que subir `version`.
 *
 * Los textos de preguntas y opciones son los del PDF "FORMULARIO ENCUESTA
 * EXPECTATIVAS". Los identificadores (id, valor) son los nombres de las
 * variables en la base: no se deben cambiar después de salir a campo.
 */

export type TipoPregunta = 'unica' | 'multiple' | 'texto' | 'fecha' | 'documento'

/** [valor que se guarda, texto que se muestra]. */
export type Opcion = readonly [valor: string, etiqueta: string]

/** Muestra la pregunta o la sección solo si otra respuesta está (o no está) entre ciertos valores. */
export type Condicion = { pregunta: string; en?: readonly string[]; noEn?: readonly string[] }

export type Seccion = { id: string; titulo: string; mostrarSi?: Condicion }

export type FormatoDocumento = 'numerico' | 'alfanumerico'

export type Pregunta = {
  id: string
  seccion: string
  tipo: TipoPregunta
  texto: string
  ayuda?: string
  opciones?: readonly Opcion[]
  obligatoria?: boolean
  mostrarSi?: Condicion
  /** La pregunta del corte inicial que abre una de las rutas. */
  ramifica?: boolean
  /** El paso donde se valida a quien responde: su documento y su fecha de nacimiento. */
  validacion?: boolean
  /** Se pide dentro del paso de validación, no como un paso aparte. */
  enValidacion?: boolean
  /** Fechas AAAA-MM-DD. */
  min?: string
  max?: string
  maxLongitud?: number
}


export const INSTRUMENTO = {
  id: 'expectativas_grado11',
  version: '2026.2',
  titulo: 'Encuesta de expectativas',
  publico: 'Estudiantes de grado 11 de Medellín',
  descripcion:
    'Queremos entender qué quieres hacer al terminar el bachillerato y qué necesitas para lograrlo. Lo que respondas será utilizado como insumo para tomar decisiones en Sapiencia y en la Alcaldía de Medellín.',
  minutos: 8,
  contacto: 'observatorio@sapiencia.gov.co',
  // TODO Sapiencia: URL pública de la política de tratamiento de datos. Vacía, el enlace no se muestra.
  politicaUrl: '',
  guiaOfertaUrl: 'https://sapiencia.gov.co/guia-digital',
}

/**
 * Aviso de tratamiento de datos.
 * TODO Sapiencia: texto provisional. Debe revisarlo el área jurídica. La casilla
 * de autorización de madre, padre o acudiente se quitó por observación de la revisión.
 */
export const AVISO_DATOS = {
  titulo: 'Tratamiento de tus datos personales',
  parrafos: [
    'Sapiencia, Agencia de Educación Postsecundaria de Medellín, es responsable de los datos que registres en esta encuesta: tu tipo y número de documento, tu fecha de nacimiento y tus respuestas.',
    'Tu documento y tu fecha de nacimiento sirven para confirmar que estás en la lista de estudiantes que pueden responder. Tus respuestas las usamos solo con fines estadísticos y para planear la oferta de educación postsecundaria de la ciudad. Los resultados se publican agregados, nunca de forma que te identifiquen.',
    'Participar es voluntario. Puedes dejar la encuesta en cualquier momento. Como titular tienes derecho a conocer, actualizar, rectificar y pedir que se supriman tus datos, según la Ley 1581 de 2012.',
  ],
  autorizacion: 'Leí esta información y autorizo el tratamiento de mis datos personales para estos fines.',
}

/** Secciones en el orden del PDF. Las rutas se abren según el corte inicial. */
export const SECCIONES: Seccion[] = [
  { id: 'caracterizacion', titulo: 'Sobre ti' },
  { id: 'corte_inicial', titulo: 'Tu decisión' },
  {
    id: 'ruta_estudiar',
    titulo: 'Tu camino: estudiar',
    mostrarSi: { pregunta: 'decision_bachillerato', en: ['estudiar'] },
  },
  {
    id: 'ruta_trabajar',
    titulo: 'Tu camino: trabajar',
    mostrarSi: { pregunta: 'decision_bachillerato', en: ['trabajar'] },
  },
  {
    id: 'ruta_mixta',
    titulo: 'Tu camino: estudiar y trabajar',
    mostrarSi: { pregunta: 'decision_bachillerato', en: ['estudiar_trabajar'] },
  },
  {
    id: 'ruta_indefinida',
    titulo: 'Tu camino: en definición',
    mostrarSi: { pregunta: 'decision_bachillerato', en: ['indefinido'] },
  },
]

/**
 * Formato del número según el tipo de documento. Los colombianos son solo
 * dígitos; los extranjeros pueden traer letras, y en el celular eso cambia el
 * teclado que se muestra.
 */
export const FORMATO_DOCUMENTO: Record<string, FormatoDocumento> = {
  registro_civil: 'numerico',
  tarjeta_identidad: 'numerico',
  cedula_ciudadania: 'numerico',
  pasaporte: 'alfanumerico',
  documento_extranjero: 'alfanumerico',
  permiso_especial_permanencia: 'alfanumerico',
  cedula_extranjeria: 'alfanumerico',
}

const TIPOS_DOCUMENTO: Opcion[] = [
  ['registro_civil', 'Registro Civil'],
  ['tarjeta_identidad', 'Tarjeta de Identidad'],
  ['cedula_ciudadania', 'Cédula de Ciudadanía'],
  ['pasaporte', 'Pasaporte'],
  ['documento_extranjero', 'Documento Extranjero'],
  ['permiso_especial_permanencia', 'Permiso Especial de Permanencia'],
  ['cedula_extranjeria', 'Cédula de Extranjería'],
  ['sin_documento', 'Sin Documento'],
]

const TIEMPO_FORMACION: Opcion[] = [
  ['menos_6_meses', 'Menos de 6 meses, quiero habilidades concretas y salir a trabajar ya'],
  ['6_meses_1_ano', 'Entre 6 meses y 1 año, un curso intensivo que cambie mi perfil rápido'],
  ['1_2_anos', 'Entre 1 y 2 años, técnico o tecnólogo con salida laboral clara'],
  ['3_4_anos', 'Entre 3 y 4 años, carrera universitaria, sin los años extra'],
  ['5_anos_o_mas', '5 años o más, quiero la formación más completa, aunque tome su tiempo'],
  ['sin_limite', 'El tiempo no me define, si el programa es el correcto, lo que tome'],
]

const MUNDOS_INTERES: Opcion[] = [
  ['digital', 'Lo digital, tecnología, programación, datos e inteligencia artificial'],
  ['visual_creativo', 'Lo visual y creativo, diseño, arte, comunicación, publicidad'],
  ['negocios', 'Los negocios, emprendimiento, finanzas, mercadeo o gestión'],
  ['salud', 'La salud, medicina, psicología, nutrición, bienestar'],
  ['social', 'Lo social, educación, derecho, trabajo social, territorio'],
  ['tecnico', 'Lo técnico, ingeniería, construcción, electricidad, mecánica, manufactura'],
  ['entretenimiento', 'El entretenimiento, música, gaming, contenido, cine, redes sociales'],
  ['ciencia', 'La ciencia, biología, química, física, matemáticas, estadística o medio ambiente'],
]

const PREPARACION_COLEGIO: Opcion[] = [
  ['mucho', 'Mucho, orientación real, información concreta y acompañamiento'],
  ['algo', 'Algo, me informaron, pero sin ayudarme realmente a decidir'],
  ['poco', 'Poco, tuve que buscar la información por mi cuenta'],
  ['nada', 'Nada, salí del colegio completamente desorientado'],
]

// Misma variable y mismos valores; solo cambia la redacción de la última opción,
// como en el PDF.
const PREPARACION_COLEGIO_MIXTA: Opcion[] = PREPARACION_COLEGIO.map(([valor, etiqueta]): Opcion =>
  valor === 'nada' ? [valor, 'Nada, salí completamente desorientado'] : [valor, etiqueta],
)

export const PREGUNTAS: Pregunta[] = [
  // ── Caracterización ─────────────────────────────────────────────
  {
    id: 'tipo_documento',
    seccion: 'caracterizacion',
    tipo: 'unica',
    texto: 'Tipo de documento',
    opciones: TIPOS_DOCUMENTO,
  },
  // El número y la fecha se piden juntos en el paso de validación (ver logica.js):
  // el número no tiene paso propio y la fecha es el paso donde se valida.
  {
    id: 'numero_documento',
    seccion: 'caracterizacion',
    tipo: 'documento',
    texto: 'Número de documento',
    ayuda: 'Escríbelo tal como aparece en tu documento.',
    mostrarSi: { pregunta: 'tipo_documento', noEn: ['sin_documento'] },
    enValidacion: true,
  },
  {
    id: 'fecha_nacimiento',
    seccion: 'caracterizacion',
    tipo: 'fecha',
    texto: 'Fecha de nacimiento',
    // Hasta hoy: la fecha la confirma la lista de estudiantes o, con la clave,
    // la edad que se muestra al escribirla.
    min: '1960-01-01',
    validacion: true,
  },
  // ── Corte inicial ───────────────────────────────────────────────
  {
    id: 'decision_bachillerato',
    seccion: 'corte_inicial',
    tipo: 'unica',
    texto: 'Al cerrar el bachillerato, ¿hacia dónde apunta tu decisión?',
    ayuda: 'Tu respuesta define el camino en la encuesta.',
    ramifica: true,
    opciones: [
      ['estudiar', 'Quiero continuar estudiando'],
      ['trabajar', 'Quiero trabajar, al menos por ahora'],
      ['estudiar_trabajar', 'Quiero estudiar y trabajar al mismo tiempo'],
      ['indefinido', 'Ninguna de las dos, o todavía no lo tengo claro'],
    ],
  },
  {
    id: 'tipo_institucion',
    seccion: 'corte_inicial',
    tipo: 'multiple',
    texto: '¿A qué tipo de institución estás pensando acceder?',
    ayuda: 'Puedes marcar más de una opción.',
    // Solo para quien va a estudiar: a quien decide trabajar o no lo tiene claro
    // no se le pregunta por universidades.
    mostrarSi: { pregunta: 'decision_bachillerato', en: ['estudiar', 'estudiar_trabajar'] },
    opciones: [
      ['universidad_publica', 'Universidad pública'],
      ['universidad_privada', 'Universidad privada'],
      ['tecnica_tecnologica', 'Institución técnica o tecnológica'],
      ['fuera_colombia', 'Una institución fuera de Colombia'],
      ['programas_cortos', 'Programas cortos presenciales o virtuales'],
      ['sin_definir', 'Todavía no lo he definido'],
    ],
  },
  // ── Ruta estudiar ───────────────────────────────────────────────
  {
    id: 'institucion_en_mente',
    seccion: 'ruta_estudiar',
    tipo: 'texto',
    texto: '¿Tienes alguna universidad o institución específica en mente?',
    ayuda: 'Escribe el nombre tal como la conoces. Si aún no lo tienes definido, puedes omitir esta pregunta.',
    obligatoria: false,
    maxLongitud: 150,
  },
  {
    id: 'programa_en_mente',
    seccion: 'ruta_estudiar',
    tipo: 'texto',
    texto: '¿Qué carrera o programa tienes en mente?',
    ayuda: 'Escríbelo como quieras, puede ser una idea amplia o una carrera concreta.',
    obligatoria: false,
    maxLongitud: 150,
  },
  {
    id: 'tiempo_formacion',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: '¿Cuánto tiempo estás dispuesto a invertir en tu formación antes de salir al mundo laboral?',
    ayuda: 'Habla de tu ritmo, no del ideal.',
    opciones: TIEMPO_FORMACION,
  },
  {
    id: 'mundos_interes',
    seccion: 'ruta_estudiar',
    tipo: 'multiple',
    texto: '¿Qué mundos te llaman?',
    ayuda: 'Puedes marcar varios.',
    opciones: MUNDOS_INTERES,
  },
  {
    id: 'elemento_no_negociable',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: 'Si pudieras diseñar tu carrera ideal desde cero, ¿qué elemento sería absolutamente no negociable?',
    opciones: [
      ['empleabilidad', 'Alta empleabilidad y demanda real en el mercado'],
      ['creacion', 'Espacio para crear y expresar sin límites'],
      ['impacto', 'Que genere un impacto concreto en mi comunidad'],
      ['tecnologia', 'Conexión directa con nuevas tecnologías'],
    ],
  },
  {
    id: 'influencia_redes',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: '¿Cuánto influyeron las redes sociales en tu decisión de carrera?',
    opciones: [
      ['muchisimo', 'Muchísimo, TikTok, YouTube e Instagram u otra red social me mostraron el camino'],
      ['bastante', 'Bastante, las redes me revelaron opciones que desconocía'],
      ['algo', 'Algo, confirmaron lo que ya sabía'],
      ['poco', 'Poco, mi decisión viene de experiencias personales, familiares o sociales'],
      ['nada', 'Nada, nunca busqué esto en internet'],
    ],
  },
  {
    id: 'ia_titulo',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: 'Una IA puede darte todo el conocimiento de una carrera y generarte el título. ¿Lo harías?',
    opciones: [
      ['si_conocimiento', 'Sí, lo que importa es el conocimiento y el título, no el camino'],
      ['si_certifica', 'Sí, si la IA certifica que realmente aprendí'],
      ['no_experiencia', 'No, la experiencia universitaria cambia quién eres'],
      ['depende', 'Depende de la carrera, en algunas sí, en otras no'],
    ],
  },
  {
    id: 'formatos_nuevos',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: '¿Qué tan dispuesto estás a estudiar en formatos que todavía no existen en Colombia?',
    opciones: [
      ['muy_dispuesto', 'Muy dispuesto, el formato no importa, importa lo que aprendo'],
      ['dispuesto', 'Dispuesto, si tiene reconocimiento y empleabilidad'],
      ['poco', 'Poco, prefiero algo conocido que todo el mundo conozca'],
      ['no', 'No, quiero la experiencia presencial tradicional'],
    ],
  },
  {
    id: 'miedo_postsecundaria',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: '¿Cuál es tu miedo más honesto frente a la educación postsecundaria?',
    opciones: [
      ['costo', 'El costo, estudiar puede generarme una deuda que tarde años en pagar'],
      ['desempleo', 'Estudiar cinco años y no encontrar trabajo en lo que estudié'],
      ['carrera_equivocada', 'Elegir la carrera equivocada y desperdiciar el tiempo y el dinero'],
      ['capacidad', 'No ser lo suficientemente capaz para completar la carrera'],
      ['ia_irrelevante', 'Que la IA haga irrelevante lo que voy a estudiar antes de graduarme'],
    ],
  },
  {
    id: 'oferta_sin_titulo',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: 'Una empresa que te encanta te ofrece el trabajo de tus sueños hoy, sin exigirte título. ¿Qué harías?',
    opciones: [
      ['acepto', 'Acepto sin dudarlo, el título ya no garantiza nada'],
      ['acepto_y_estudio', 'Acepto, pero seguiría estudiando en paralelo'],
      ['no_acepto', 'No acepto, necesito el respaldo formal del título'],
      ['negocio', 'Negocio, acepto si me apoyan para estudiar después'],
    ],
  },
  {
    id: 'financiacion_estudio',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: '¿Cómo planeas costear tu educación superior?',
    opciones: [
      ['beca_publica', 'Beca pública: Sapiencia, Presupuesto Participativo u algún otro'],
      ['familia', 'Mi familia puede asumir el costo'],
      ['trabajo', 'Trabajaré mientras estudio'],
      ['credito', 'Crédito educativo del ICETEX u otra entidad'],
      ['sin_resolver', 'Honestamente, aún no lo tengo resuelto'],
    ],
  },
  {
    id: 'preparacion_colegio_decision',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: '¿Qué tan bien te preparó tu colegio para tomar esta decisión?',
    opciones: PREPARACION_COLEGIO,
  },
  {
    id: 'oferta_sapiencia',
    seccion: 'ruta_estudiar',
    tipo: 'multiple',
    texto: '¿Qué tendría que ofrecerte Sapiencia para que tu camino hacia la educación fuera más alcanzable?',
    ayuda: 'Puedes marcar varias.',
    opciones: [
      ['beca_matricula', 'Una beca que cubra matrícula completa, sin condiciones imposibles'],
      ['subsidio_sostenimiento', 'Un subsidio de sostenimiento para transporte y alimentación mientras estudio'],
      ['orientacion_vocacional', 'Orientación vocacional real y acompañamiento personalizado, no charlas'],
      ['preparacion_admision', 'Preparación gratuita para las pruebas de admisión'],
      ['programas_nuevos', 'Programas nuevos que respondan a lo que el mundo laboral realmente pide'],
      ['informacion_honesta', 'Información honesta sobre qué carreras tienen futuro y cuáles no'],
      ['conexion_empleadores', 'Conexión directa con empleadores antes de graduarme'],
    ],
  },
  {
    id: 'vision_cinco_anos_estudiar',
    seccion: 'ruta_estudiar',
    tipo: 'unica',
    texto: 'Cinco años desde hoy. ¿Cuál es la imagen de tu mejor versión posible?',
    opciones: [
      ['trabajo_global', 'Trabajando desde cualquier parte del mundo'],
      ['liderar', 'Liderando algo que construí yo mismo'],
      ['negocio_medellin', 'Con mi propio negocio generando impacto en Medellín'],
      ['investigar', 'Investigando o creando algo que nadie más hace acá'],
      ['impacto_ciudad', 'Con algo visible que cambié en mi ciudad'],
    ],
  },
  // ── Ruta trabajar ───────────────────────────────────────────────
  {
    id: 'razon_trabajar',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: '¿Cuál es la razón real por la que decidiste trabajar antes de estudiar?',
    opciones: [
      ['ingresos', 'Necesito generar ingresos para mí o para mi familia ahora'],
      ['experiencia', 'Quiero acumular experiencia antes de elegir qué estudiar'],
      ['sin_claridad', 'Todavía no sé qué carrera quiero y no quiero equivocarme'],
      ['oferta_no_convence', 'No me convencen las opciones de estudio disponibles'],
      ['trabajo_ensena', 'Creo que el trabajo enseña más que una carrera formal'],
    ],
  },
  {
    id: 'mundo_laboral',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: '¿En qué mundo laboral quieres aterrizar primero?',
    opciones: [
      ['tecnologia', 'Tecnología y economía digital, código, datos, diseño'],
      ['emprendimiento', 'Emprendimiento, quiero crear mi propio negocio'],
      ['empresa_consolidada', 'Una empresa consolidada'],
      ['oficio_tecnico', 'Algún oficio técnico'],
      ['arte_cultura', 'Arte, cultura, música o industria del entretenimiento'],
    ],
  },
  {
    id: 'horizonte_estudio',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: '¿En qué horizonte de tiempo visualizas estudiar formalmente?',
    opciones: [
      ['menos_1_ano', 'Menos de 1 año, ya tengo planes concretos'],
      ['1_3_anos', 'Entre 1 y 3 años'],
      ['mas_3_anos', 'Más de 3 años, primero necesito estabilizarme'],
      ['no_regreso', 'Probablemente no regrese a la educación'],
      ['no_se', 'Aún no lo sé'],
    ],
  },
  {
    id: 'aprendizaje_autonomo',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: '¿Cuánto estás dispuesto a aprender por tu propia cuenta, sin matrícula ni clases?',
    opciones: [
      ['todo', 'Todo lo que pueda, no necesito institución para aprender'],
      ['bastante', 'Bastante, lo usaré como herramienta permanente de crecimiento'],
      ['algo', 'Algo, para temas puntuales que el trabajo me vaya pidiendo'],
      ['poco', 'Poco, prefiero aprender directamente haciendo'],
    ],
  },
  {
    id: 'preocupacion_ia',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: '¿Cuánto te preocupa el impacto de la IA en el trabajo que quieres hacer?',
    opciones: [
      ['mucho', 'Mucho, y ya me estoy preparando activamente para eso'],
      ['bastante', 'Bastante, lo pienso con frecuencia, pero no sé cómo responder'],
      ['poco', 'Poco, mi área de interés tiene algo que la IA no puede reemplazar'],
      ['nada', 'Nada, no me preocupa o no pienso en eso'],
    ],
  },
  {
    id: 'obstaculo_trabajo',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: '¿Qué obstáculo sientes más real entre tú y el trabajo que quieres tener?',
    opciones: [
      ['contactos', 'No tengo los contactos ni la red de personas'],
      ['experiencia', 'Me exigen experiencia que todavía no tengo'],
      ['desigualdad', 'Desigualdad o discriminación que me cierra puertas'],
      ['habilidades', 'Me faltan habilidades técnicas que el mercado pide'],
      ['orientacion', 'No sé por dónde empezar ni a quién pedirle orientación'],
    ],
  },
  {
    id: 'apoyo_medellin',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: 'Si Medellín pudiera darte una sola cosa para ayudarte a lograrlo, ¿qué sería?',
    opciones: [
      ['subsidio', 'Un subsidio o apoyo económico directo'],
      ['formacion_tecnica', 'Formación técnica gratuita y de alta calidad'],
      ['conexion_empleadores', 'Conexión real con empleadores y oportunidades concretas'],
      ['mentoria', 'Mentoría personalizada de alguien que ya lo logró'],
      ['espacio_fisico', 'Un espacio físico para trabajar, crear o emprender'],
    ],
  },
  {
    id: 'preparacion_colegio_trabajo',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: '¿Qué tan bien te preparó tu colegio para entrar al mundo del trabajo?',
    opciones: [
      ['mucho', 'Mucho, herramientas reales y conexión directa con el entorno'],
      ['algo', 'Algo, me informaron, pero sin conectarme con la realidad'],
      ['poco', 'Poco, tuve que buscar la información por mi cuenta'],
      ['nada', 'Nada, salí sin ninguna preparación para esto'],
    ],
  },
  {
    id: 'acciones_alcaldia',
    seccion: 'ruta_trabajar',
    tipo: 'multiple',
    texto: '¿Qué tendría que hacer la Alcaldía de Medellín o Sapiencia para acercarte a tus metas?',
    ayuda: 'Puedes marcar varias.',
    opciones: [
      ['empleadores_sin_experiencia', 'Conectarme con empleadores que contraten jóvenes sin experiencia previa'],
      ['formacion_corta', 'Formación técnica corta, gratuita y con salida laboral garantizada'],
      ['mentoria_emprender', 'Recursos y mentoría para emprender sin capital inicial'],
      ['certificar_saberes', 'Certificar los saberes que ya tengo, aunque no los haya aprendido en un aula'],
      ['subsidio_busqueda', 'Un subsidio mientras busco trabajo, para no tener que aceptar cualquier cosa'],
      ['red_contactos', 'Una red de contactos reales, no ferias de empleo, sino conexiones útiles'],
      ['orientacion_honesta', 'Orientación honesta sobre qué trabajos tienen futuro en esta ciudad'],
    ],
  },
  {
    id: 'vision_cinco_anos_trabajar',
    seccion: 'ruta_trabajar',
    tipo: 'unica',
    texto: 'Cinco años desde hoy. ¿Cuál es la imagen de tu mejor versión posible?',
    opciones: [
      ['independencia', 'Con independencia económica total, sin depender de nadie'],
      ['negocio_propio', 'Con mi propio negocio que ya genera trabajo para otros'],
      ['referente', 'Como referente reconocido en lo que hago'],
      ['familia', 'Pudiendo darle a mi familia lo que no tuvieron'],
      ['impacto_barrio', 'Con un impacto visible en mi barrio o ciudad'],
    ],
  },
  // ── Ruta estudiar y trabajar ────────────────────────────────────
  {
    id: 'razon_estudiar_trabajar',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: '¿Qué te lleva a querer estudiar y trabajar al mismo tiempo?',
    ayuda: 'La razón de fondo.',
    opciones: [
      ['necesidad_economica', 'Necesidad económica, sin ingresos no puedo sostener el estudio'],
      ['no_perder_tiempo', 'No quiero perder tiempo, prefiero ganar experiencia mientras me formo'],
      ['independencia', 'Quiero independencia económica desde ya, sin esperar a graduarme'],
      ['probar_practica', 'Quiero probar en la práctica si lo que estudio realmente sirve'],
      ['ritmo_natural', 'Es mi ritmo natural, no concibo hacer una sola cosa a la vez'],
    ],
  },
  {
    id: 'institucion_en_mente',
    seccion: 'ruta_mixta',
    tipo: 'texto',
    texto: '¿Tienes alguna universidad o institución específica en mente?',
    ayuda: 'Escribe el nombre tal como la conoces. Si aún no lo tienes definido, puedes omitir esta pregunta.',
    obligatoria: false,
    maxLongitud: 150,
  },
  {
    id: 'programa_en_mente',
    seccion: 'ruta_mixta',
    tipo: 'texto',
    texto: '¿Qué carrera o programa tienes en mente?',
    ayuda: 'Escríbelo como quieras, puede ser una idea amplia o una carrera concreta.',
    obligatoria: false,
    maxLongitud: 150,
  },
  {
    id: 'tiempo_formacion',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: '¿Cuánto tiempo estás dispuesto a invertir en tu formación antes de salir al mundo laboral?',
    ayuda: 'Habla de tu ritmo, no del ideal.',
    opciones: TIEMPO_FORMACION,
  },
  {
    id: 'mundos_interes',
    seccion: 'ruta_mixta',
    tipo: 'multiple',
    texto: '¿Qué mundos te llaman?',
    ayuda: 'Puedes marcar varios.',
    opciones: MUNDOS_INTERES,
  },
  {
    id: 'tension_estudiar_trabajar',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: '¿Cuál será la tensión más difícil de manejar entre estudiar y trabajar?',
    opciones: [
      ['tiempo', 'El tiempo, no alcanza para las dos cosas con calidad'],
      ['energia', 'La energía, llegar agotado al estudio o al trabajo'],
      ['dinero', 'El dinero, los ingresos no alcanzan para pagar el estudio'],
      ['prioridades', 'Las prioridades, cuando ambas exijan lo mismo a la vez'],
      ['rendimiento', 'El rendimiento académico, trabajar baja el aprendizaje real'],
    ],
  },
  {
    id: 'prioridad_si_elegir',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: 'Si en algún momento tuvieras que elegir uno, ¿cuál priorizarías?',
    opciones: [
      ['estudio', 'El estudio, es la base que no puedo perder'],
      ['trabajo', 'El trabajo, la estabilidad económica es más urgente'],
      ['depende', 'Depende del momento, no hay una respuesta fija'],
      ['ambos', 'No lo contemplo, voy a lograr que los dos funcionen'],
    ],
  },
  {
    id: 'red_apoyo',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: '¿Con qué red de apoyo cuentas para sostener ese ritmo?',
    opciones: [
      ['familia_completa', 'Familia que me apoya económica y emocionalmente'],
      ['familia_limitada', 'Algo de apoyo familiar, pero limitado'],
      ['solo', 'Prácticamente solo, me la tengo que arreglar yo mismo'],
      ['institucional', 'Becas, subsidios o apoyos institucionales'],
    ],
  },
  {
    id: 'miedo_dos_cosas',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: '¿Cuál es tu miedo más honesto al intentar las dos cosas a la vez?',
    opciones: [
      ['fracasar', 'Fracasar en las dos y terminar sin nada sólido'],
      ['mediocridad', 'Ser mediocre en ambas y no destacar en ninguna'],
      ['agotamiento', 'El agotamiento, que el cuerpo o la mente no aguanten'],
      ['perder_experiencia', 'Perder la experiencia universitaria plena por estar siempre ocupado'],
      ['abandono', 'Que el trabajo termine ganando y abandone el estudio a medias'],
    ],
  },
  {
    id: 'financiacion_estudio_trabajo',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: '¿Cómo planeas costear el estudio además del trabajo?',
    opciones: [
      ['trabajo_cubre', 'El mismo trabajo cubrirá los costos del estudio'],
      ['beca_mas_trabajo', 'Beca o subsidio público más el trabajo como complemento'],
      ['familia_mas_trabajo', 'Apoyo familiar más lo que gane yo'],
      ['credito', 'Crédito educativo del ICETEX u otra entidad'],
      ['sin_resolver', 'Todavía no lo tengo completamente resuelto'],
    ],
  },
  {
    id: 'preparacion_colegio_decision',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: '¿Qué tan bien te preparó tu colegio para tomar esta decisión?',
    opciones: PREPARACION_COLEGIO_MIXTA,
  },
  {
    id: 'oferta_combinacion',
    seccion: 'ruta_mixta',
    tipo: 'multiple',
    texto: '¿Qué tendría que ofrecerte Sapiencia o la Alcaldía para que la combinación sea posible?',
    ayuda: 'Puedes marcar varias.',
    opciones: [
      ['becas_flexibles', 'Becas que se adapten a horarios de trabajo, nocturnas, virtuales, tiempo parcial'],
      ['subsidio_sostenimiento', 'Un subsidio de sostenimiento para no tener que elegir entre estudiar y trabajar'],
      ['horarios_laborales', 'Programas con horarios pensados para personas que trabajan'],
      ['creditos_por_experiencia', 'Que mi experiencia laboral cuente como créditos en la carrera'],
      ['orientacion_laboral', 'Orientación para encontrar trabajo relacionado con lo que estoy estudiando'],
      ['empresas_flexibles', 'Conexión con empresas que valoren que estés estudiando y te den facilidades'],
      ['informacion_honesta', 'Información honesta y actualizada sobre qué combinaciones de estudio y trabajo funcionan'],
    ],
  },
  {
    id: 'vision_cinco_anos_mixta',
    seccion: 'ruta_mixta',
    tipo: 'unica',
    texto: 'Cinco años desde hoy. ¿Cuál es la imagen de tu mejor versión posible?',
    opciones: [
      ['titulo_y_trayectoria', 'Con título y una trayectoria laboral ya construida'],
      ['negocio_propio', 'Con mi propio negocio que nació mientras estudiaba'],
      ['mas_experimentado', 'Como el más experimentado de mi generación en mi campo'],
      ['independencia', 'Con independencia económica total, sin deudas'],
      ['impacto_barrio', 'Con un impacto visible en mi barrio o ciudad'],
    ],
  },
  // ── Ruta en definición ──────────────────────────────────────────
  {
    id: 'razon_indecision',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: '¿Cuál es la razón más honesta por la que todavía no tienes claro qué hacer después del bachillerato?',
    opciones: [
      ['ninguna_encaja', 'Conozco las opciones, pero ninguna me parece para mí'],
      ['falta_informacion', 'No tengo suficiente información real sobre lo que existe'],
      ['situacion_economica', 'La situación económica de mi familia hace que ninguna opción sea clara'],
      ['miedo_equivocarse', 'El miedo a equivocarme me paraliza'],
      ['responsabilidades', 'Tengo responsabilidades en casa que condicionan lo que puedo hacer'],
      ['agotamiento', 'Estoy agotado o desmotivado después de lo que viví en el colegio'],
    ],
  },
  {
    id: 'escenario_probable',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: 'Si tuvieras que apostar hoy, ¿cuál es el escenario más probable para ti en los próximos seis meses?',
    ayuda: 'No el que quieres, el que más probablemente ocurrirá.',
    opciones: [
      ['en_casa', 'Quedarme en casa sin estudiar ni trabajar formalmente'],
      ['informal', 'Hacer trabajos informales o eventuales mientras decido'],
      ['admision', 'Prepararme para una admisión universitaria'],
      ['trabajo_formal', 'Buscar activamente un trabajo formal'],
      ['no_se', 'Honestamente no lo sé'],
    ],
  },
  {
    id: 'presion_decision',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: '¿Cómo describes la presión que sientes para que tomes una decisión?',
    opciones: [
      ['muy_alta', 'Muy alta, la siento todos los días y me genera ansiedad'],
      ['moderada', 'Moderada, hay comentarios, pero puedo manejarlo'],
      ['poca', 'Poca, me rodean personas que entienden que necesito tiempo'],
      ['ninguna', 'Ninguna, nadie espera mucho de mí, o a nadie le importa'],
    ],
  },
  {
    id: 'freno_actual',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: '¿Qué es lo que más te está frenando en este momento?',
    opciones: [
      ['dinero', 'El dinero, no hay recursos para estudiar ni para arrancar'],
      ['orientacion', 'No tengo personas que me orienten o me abran puertas'],
      ['identidad', 'No sé qué quiero ni quién quiero ser todavía'],
      ['sistema_cerrado', 'El sistema está cerrado para alguien con mis condiciones'],
      ['responsabilidad_hogar', 'Una responsabilidad concreta en mi hogar que ocupa mi tiempo'],
    ],
  },
  {
    id: 'autopercepcion_capacidad',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: 'Cuando piensas en tu capacidad para estudiar o trabajar con éxito, ¿qué sientes?',
    ayuda: 'La voz interior, sin censura.',
    opciones: [
      ['capaz_sin_camino', 'Me siento capaz, el problema es no encontrar el camino'],
      ['dudo', 'A veces dudo si soy lo suficientemente bueno para eso'],
      ['sistema_no_disenado', 'No es capacidad, el sistema no fue diseñado para mí'],
      ['bloqueado', 'Me siento bloqueado por factores que están fuera de mi control'],
    ],
  },
  {
    id: 'detonante_decision',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: '¿Qué tendría que pasar para que decidas concretamente, sea estudiar o trabajar?',
    ayuda: 'El detonante real.',
    opciones: [
      ['apoyo_economico', 'Apoyo económico concreto que resuelva la presión del día a día'],
      ['opcion_que_encaje', 'Encontrar una opción que de verdad encaje conmigo'],
      ['orientacion_sin_juicio', 'Alguien que me oriente sin juzgarme y me ayude a dar el primer paso'],
      ['resolver_situacion', 'Resolver primero la situación que me tiene frenado'],
      ['tiempo', 'Tiempo, necesito un poco más para aclarar mis ideas'],
    ],
  },
  {
    id: 'confianza_instituciones',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: '¿Cuánta confianza tienes en que las instituciones de Medellín tienen algo real para ofrecerte?',
    opciones: [
      ['mucha', 'Mucha, creo que hay opciones reales si las busco bien'],
      ['algo', 'Algo, hay opciones, pero no están pensadas para alguien como yo'],
      ['poca', 'Poca, la oferta existe, pero queda fuera de mi alcance'],
      ['ninguna', 'Ninguna, el sistema ha demostrado que no es para todos'],
    ],
  },
  {
    id: 'necesidad_apoyo',
    seccion: 'ruta_indefinida',
    tipo: 'multiple',
    texto: 'Si la Alcaldía o Sapiencia pudieran crear algo para alguien en tu situación, ¿qué necesitarías?',
    ayuda: 'Puedes marcar varias.',
    opciones: [
      ['espacio_explorar', 'Un espacio donde pueda explorar mis opciones sin presión y sin juicio'],
      ['apoyo_economico', 'Apoyo económico que me quite la presión del día a día mientras decido'],
      ['orientador_real', 'Un orientador que me acompañe de verdad, no un folleto ni una charla'],
      ['formacion_adaptada', 'Opciones de formación que se adapten a mi situación real, no al promedio'],
      ['pares', 'Conectarme con otros jóvenes que estuvieron igual y encontraron su camino'],
      ['informacion_honesta', 'Información honesta y sin adornos sobre qué opciones existen para mí hoy'],
      ['resolver_freno', 'Apoyo para resolver primero lo que me tiene frenado, no formación aún'],
    ],
  },
  {
    id: 'vision_cinco_anos_indefinida',
    seccion: 'ruta_indefinida',
    tipo: 'unica',
    texto: '¿Puedes imaginarte en cinco años con una vida que quisieras tener?',
    ayuda: 'Una pregunta sobre la esperanza, no sobre los planes.',
    opciones: [
      ['imagen_clara', 'Sí, tengo una imagen clara y quiero llegar ahí'],
      ['imagen_lejana', 'La tengo, pero la siento muy lejana o difícil de alcanzar'],
      ['imagen_borrosa', 'La imagen es borrosa, no sé cómo sería esa vida'],
      ['sin_espacio', 'No, el presente ocupa todo y no hay espacio para eso'],
    ],
  },
]

