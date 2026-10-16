// Unidad 1 — Saludos cotidianos, compras y vida en comunidad.
//
// ⚠️ CONTENIDO DE EJEMPLO: sirve para que el curso funcione de punta a punta.
// Reemplázalo con el contenido real de la Fundación (mismo formato).
//
// Formato de un ejercicio (ver src/curso/contenido/index.js para todos los tipos):
//   { tipo: 'opcion',    pregunta, opciones: [..], correcta: <índice>, explicacion? }
//   { tipo: 'escuchar',  audio,    opciones: [..], correcta: <índice> }   // lee `audio` en voz alta
//   { tipo: 'completar', frase: 'Mucho ___.', opciones: [..], correcta: <índice> }
//   { tipo: 'emparejar', pares: [[izquierda, derecha], ...] }

export default {
  id: 1,
  lecciones: [
    {
      id: 'u1-l1',
      titulo: 'Saludos',
      ejercicios: [
        { tipo: 'opcion', pregunta: 'Es por la mañana. ¿Qué dices?', opciones: ['Buenos días', 'Buenas noches', 'Hasta mañana'], correcta: 0 },
        { tipo: 'escuchar', audio: 'Buenas tardes', opciones: ['Buenos días', 'Buenas tardes', 'Buenas noches'], correcta: 1 },
        { tipo: 'completar', frase: 'Mucho ___.', opciones: ['gusto', 'bien', 'hola'], correcta: 0 },
        { tipo: 'emparejar', pares: [['Hola', 'Saludo informal'], ['Adiós', 'Despedida'], ['Gracias', 'Agradecimiento'], ['Por favor', 'Cortesía al pedir']] },
        { tipo: 'opcion', pregunta: '¿Cómo respondes a «¿Cómo estás?»?', opciones: ['Bien, gracias', 'Buenas noches', 'De nada'], correcta: 0 }
      ]
    },
    {
      id: 'u1-l2',
      titulo: 'En la tienda',
      ejercicios: [
        { tipo: 'opcion', pregunta: 'Quieres saber el precio. ¿Qué preguntas?', opciones: ['¿Cuánto cuesta?', '¿Cómo te llamas?', '¿Dónde vives?'], correcta: 0 },
        { tipo: 'completar', frase: 'Quiero ___ kilo de arroz.', opciones: ['un', 'una', 'uno'], correcta: 0 },
        { tipo: 'escuchar', audio: 'Son cinco dólares', opciones: ['Son tres dólares', 'Son cinco dólares', 'Son diez dólares'], correcta: 1 },
        { tipo: 'emparejar', pares: [['Pan', 'Panadería'], ['Medicina', 'Farmacia'], ['Frutas', 'Mercado']] },
        { tipo: 'opcion', pregunta: 'Para pagar dices:', opciones: ['Quiero pagar, por favor', 'Buenos días', 'Mucho gusto'], correcta: 0 }
      ]
    },
    {
      id: 'u1-l3',
      titulo: 'Mi comunidad',
      ejercicios: [
        { tipo: 'opcion', pregunta: 'Una persona que vive cerca de ti es tu...', opciones: ['vecino', 'maestro', 'médico'], correcta: 0 },
        { tipo: 'completar', frase: 'Mi ___ es muy amable; vive al lado de mi casa.', opciones: ['vecina', 'comida', 'camino'], correcta: 0 },
        { tipo: 'opcion', pregunta: '¿Qué es una minga?', opciones: ['Trabajo comunitario en conjunto', 'Una fiesta de cumpleaños', 'Un tipo de comida'], correcta: 0, explicacion: 'La minga es una tradición andina: la comunidad trabaja unida por un objetivo común.' },
        { tipo: 'escuchar', audio: 'Buenas tardes, vecino', opciones: ['Buenas tardes, vecino', 'Buenos días, doctor', 'Buenas noches, amiga'], correcta: 0 },
        { tipo: 'emparejar', pares: [['Vecino', 'Persona que vive cerca'], ['Minga', 'Trabajo comunitario'], ['Barrio', 'Zona de una ciudad']] }
      ]
    }
  ]
};
