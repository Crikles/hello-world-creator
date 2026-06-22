// Per-step copy for the international (Global) flow.
// 10 steps × 2 languages (EN/ES) × { email + SMS }.

export type Lang = "en" | "es";

export interface EmailContent {
  subject: string;
  preview: string;
  headline: string;        // big title at top of email
  intro: string;           // first paragraph, after "Hi <name>,"
  body: string;            // main paragraph for this step
  hint?: string;           // optional secondary note (callout)
  ctaLabel: string;        // tracking button
  closing: string;         // line above signature
  product?: string;        // optional product name (shown only in step 1)
}

export interface StepCtx {
  name: string;            // customer first name
  empresa: string;         // store name
  originCountry: string;   // country of origin label
  tracking: string;        // tracking code (may be empty)
  produto?: string;        // product name (used only by step 1)
}


type EmailFn = (ctx: StepCtx) => EmailContent;
type SmsFn = (ctx: StepCtx & { link: string }) => string;

// ============================================================
// ENGLISH (US)
// ============================================================
const EMAIL_EN: Record<number, EmailFn> = {
  1: (c) => ({
    subject: `Order received — we're getting it ready`,
    preview: `Thanks ${c.name}! Your order from ${c.empresa} is confirmed.`,
    headline: "Order received 🎉",
    intro: `Hi ${c.name}, thanks for shopping with ${c.empresa}!`,
    body: "We've just received your order and our team is already starting to prepare it. You'll get an update at every step — from the warehouse all the way to your door.",
    hint: "Average international delivery: 12–25 business days.",
    ctaLabel: "Track my order",
    closing: "Welcome aboard,",
    product: c.produto || undefined,
  }),

  2: (c) => ({
    subject: `Your order is packed and ready to ship`,
    preview: `Good news ${c.name} — packing is done.`,
    headline: "Order prepared 📦",
    intro: `Hi ${c.name}, quick update from ${c.empresa}.`,
    body: "Your items have been carefully checked, packed and labeled. The package is now in the queue to be picked up by our international carrier.",
    hint: "Next step: handover to the shipping carrier.",
    ctaLabel: "Track my order",
    closing: "Talk soon,",
  }),
  3: (c) => ({
    subject: `Shipped! Your order is on its way`,
    preview: `${c.name}, your package just left our warehouse.`,
    headline: "Shipped 🚚",
    intro: `Great news ${c.name} — your order has been shipped!`,
    body: `Your package has been handed over to the carrier in ${c.originCountry}. Tracking events will start appearing shortly.${c.tracking ? ` Your tracking code is ${c.tracking}.` : ""}`,
    hint: "It can take 24–48h for the first scan to appear.",
    ctaLabel: "See live tracking",
    closing: "Safe travels to your package,",
  }),
  4: (c) => ({
    subject: `Your package left ${c.originCountry}`,
    preview: `International journey started.`,
    headline: "Left country of origin ✈️",
    intro: `Hi ${c.name}, your package is officially traveling internationally.`,
    body: `It has departed from ${c.originCountry} and is now heading to your destination country. This is usually the longest leg of the trip, but every scan brings it closer.`,
    ctaLabel: "Track my order",
    closing: "We'll keep you posted,",
  }),
  5: (c) => ({
    subject: `In international transit`,
    preview: `${c.name}, your package is crossing borders.`,
    headline: "In international transit 🌍",
    intro: `Hi ${c.name}, your order is currently in international transit.`,
    body: "Updates can be less frequent during this stage — that's normal for international freight. As soon as it arrives in your country, you'll get a new notification.",
    hint: "No action needed from you right now.",
    ctaLabel: "Check status",
    closing: "Thanks for your patience,",
  }),
  6: (c) => ({
    subject: `Arrived in your country 🛬`,
    preview: `Almost there, ${c.name}.`,
    headline: "Arrived at destination country",
    intro: `Great news ${c.name} — your package just landed in your country!`,
    body: "It will now be transferred to customs for inspection and clearance before being released to the local carrier.",
    hint: "Customs clearance usually takes 1–5 business days.",
    ctaLabel: "Track my order",
    closing: "Getting closer,",
  }),
  7: (c) => ({
    subject: `In customs processing`,
    preview: `Your package is going through customs.`,
    headline: "In customs processing 🛃",
    intro: `Hi ${c.name}, a quick status update.`,
    body: "Your package is currently being processed by customs. This is a standard step for every international shipment and no action is required from you.",
    hint: "We'll notify you as soon as it's released.",
    ctaLabel: "Track my order",
    closing: "Hang tight,",
  }),
  8: (c) => ({
    subject: `Released — now in local transit`,
    preview: `Cleared customs, on the way to your city.`,
    headline: "In local transit 🚛",
    intro: `Hi ${c.name}, your package cleared customs!`,
    body: "It's now traveling through the local network and heading to the distribution center closest to your address.",
    ctaLabel: "Track my order",
    closing: "Almost there,",
  }),
  9: (c) => ({
    subject: `📍 Out for delivery — arriving today!`,
    preview: `${c.name}, your package is on the delivery truck.`,
    headline: "Out for delivery",
    intro: `Hi ${c.name}, exciting update!`,
    body: "Your package is loaded on the delivery vehicle and is scheduled to arrive today.",
    hint: "Please make sure someone is available at the address to receive it.",
    ctaLabel: "Track in real time",
    closing: "See you in a few hours,",
  }),
  10: (c) => ({
    subject: `Delivered ✅ Thanks for choosing ${c.empresa}!`,
    preview: `Your order has been delivered.`,
    headline: "Delivered",
    intro: `Hi ${c.name}, your order has been delivered!`,
    body: "We hope you love it. If anything is wrong with your order, just reply to this email and we'll make it right.",
    hint: "Would you mind sharing a quick review? It really helps us.",
    ctaLabel: "View order",
    closing: "Thanks for shopping with us,",
  }),
};

const SMS_EN: Record<number, SmsFn> = {
  1: (c) => `${c.name}, we received your order at ${c.empresa}. Track: ${c.link}`,
  2: (c) => `${c.name}, your order is packed and ready to ship. ${c.link}`,
  3: (c) => `${c.name}, your order has been shipped! Track: ${c.link}`,
  4: (c) => `${c.name}, your package left ${c.originCountry}. ${c.link}`,
  5: (c) => `${c.name}, your order is in international transit. ${c.link}`,
  6: (c) => `${c.name}, your package arrived in your country! ${c.link}`,
  7: (c) => `${c.name}, your package is in customs. No action needed. ${c.link}`,
  8: (c) => `${c.name}, cleared customs! Now in local transit. ${c.link}`,
  9: (c) => `${c.name}, OUT FOR DELIVERY today. Please be available. ${c.link}`,
  10: (c) => `${c.name}, your order has been delivered. Thank you! ${c.link}`,
};

// ============================================================
// SPANISH (ES)
// ============================================================
const EMAIL_ES: Record<number, EmailFn> = {
  1: (c) => ({
    subject: `Pedido recibido — lo estamos preparando`,
    preview: `Gracias ${c.name}! Tu pedido en ${c.empresa} fue confirmado.`,
    headline: "Pedido recibido 🎉",
    intro: `Hola ${c.name}, ¡gracias por tu compra en ${c.empresa}!`,
    body: "Acabamos de recibir tu pedido y nuestro equipo ya está empezando a prepararlo. Te avisaremos en cada etapa — desde el almacén hasta tu puerta.",
    hint: "Tiempo promedio de entrega internacional: 12–25 días hábiles.",
    ctaLabel: "Rastrear pedido",
    closing: "Bienvenido,",
  }),
  2: (c) => ({
    subject: `Tu pedido está empacado y listo para enviar`,
    preview: `Buenas noticias ${c.name} — empacado terminado.`,
    headline: "Pedido preparado 📦",
    intro: `Hola ${c.name}, una actualización rápida de ${c.empresa}.`,
    body: "Tus artículos fueron revisados, empacados y etiquetados con cuidado. El paquete ya está en la cola para ser recogido por nuestro transportista internacional.",
    hint: "Próximo paso: entrega al transportista.",
    ctaLabel: "Rastrear pedido",
    closing: "Hablamos pronto,",
  }),
  3: (c) => ({
    subject: `¡Enviado! Tu pedido va en camino`,
    preview: `${c.name}, tu paquete acaba de salir de nuestro almacén.`,
    headline: "Enviado 🚚",
    intro: `¡Buenas noticias ${c.name} — tu pedido fue enviado!`,
    body: `Tu paquete fue entregado al transportista en ${c.originCountry}. Los eventos de rastreo comenzarán a aparecer pronto.${c.tracking ? ` Tu código de rastreo es ${c.tracking}.` : ""}`,
    hint: "Puede tardar 24–48h hasta el primer escaneo.",
    ctaLabel: "Ver rastreo en vivo",
    closing: "Buen viaje a tu paquete,",
  }),
  4: (c) => ({
    subject: `Tu paquete salió de ${c.originCountry}`,
    preview: `Comenzó el viaje internacional.`,
    headline: "Salió del país de origen ✈️",
    intro: `Hola ${c.name}, tu paquete está oficialmente viajando internacionalmente.`,
    body: `Salió de ${c.originCountry} y se dirige a tu país de destino. Suele ser el tramo más largo del viaje, pero cada escaneo lo acerca más.`,
    ctaLabel: "Rastrear pedido",
    closing: "Te mantendremos al tanto,",
  }),
  5: (c) => ({
    subject: `En tránsito internacional`,
    preview: `${c.name}, tu paquete está cruzando fronteras.`,
    headline: "En tránsito internacional 🌍",
    intro: `Hola ${c.name}, tu pedido está actualmente en tránsito internacional.`,
    body: "Las actualizaciones pueden ser menos frecuentes en esta etapa — es normal en envíos internacionales. Apenas llegue a tu país, recibirás una nueva notificación.",
    hint: "No necesitas hacer nada por ahora.",
    ctaLabel: "Ver estado",
    closing: "Gracias por tu paciencia,",
  }),
  6: (c) => ({
    subject: `Llegó a tu país 🛬`,
    preview: `Ya casi, ${c.name}.`,
    headline: "Llegó al país de destino",
    intro: `Buenas noticias ${c.name} — ¡tu paquete acaba de llegar a tu país!`,
    body: "Ahora será transferido a la aduana para inspección y liberación antes de ser entregado al transportista local.",
    hint: "El proceso aduanero suele tardar 1–5 días hábiles.",
    ctaLabel: "Rastrear pedido",
    closing: "Cada vez más cerca,",
  }),
  7: (c) => ({
    subject: `En procesamiento aduanero`,
    preview: `Tu paquete está pasando por la aduana.`,
    headline: "En procesamiento aduanero 🛃",
    intro: `Hola ${c.name}, una actualización rápida.`,
    body: "Tu paquete está siendo procesado por la aduana. Es un paso estándar para todo envío internacional y no necesitas hacer nada.",
    hint: "Te avisaremos apenas sea liberado.",
    ctaLabel: "Rastrear pedido",
    closing: "Tranquilo,",
  }),
  8: (c) => ({
    subject: `Liberado — ahora en tránsito local`,
    preview: `Liberado de la aduana, en camino a tu ciudad.`,
    headline: "En tránsito local 🚛",
    intro: `Hola ${c.name}, ¡tu paquete fue liberado de la aduana!`,
    body: "Ya está viajando por la red local hacia el centro de distribución más cercano a tu dirección.",
    ctaLabel: "Rastrear pedido",
    closing: "Ya casi,",
  }),
  9: (c) => ({
    subject: `📍 Salió para entrega — ¡llega hoy!`,
    preview: `${c.name}, tu paquete está en el camión de entrega.`,
    headline: "Salió para entrega",
    intro: `Hola ${c.name}, ¡actualización importante!`,
    body: "Tu paquete está cargado en el vehículo de entrega y está programado para llegar hoy.",
    hint: "Por favor asegúrate de que haya alguien disponible para recibirlo.",
    ctaLabel: "Rastrear en tiempo real",
    closing: "Nos vemos en unas horas,",
  }),
  10: (c) => ({
    subject: `Entregado ✅ ¡Gracias por elegir ${c.empresa}!`,
    preview: `Tu pedido fue entregado.`,
    headline: "Entregado",
    intro: `Hola ${c.name}, ¡tu pedido fue entregado!`,
    body: "Esperamos que te encante. Si algo no está bien con tu pedido, solo responde a este email y lo resolveremos.",
    hint: "¿Nos dejarías una reseña rápida? Nos ayuda mucho.",
    ctaLabel: "Ver pedido",
    closing: "Gracias por tu compra,",
  }),
};

const SMS_ES: Record<number, SmsFn> = {
  1: (c) => `${c.name}, recibimos tu pedido en ${c.empresa}. Rastrear: ${c.link}`,
  2: (c) => `${c.name}, tu pedido fue empacado y está listo para enviar. ${c.link}`,
  3: (c) => `${c.name}, tu pedido fue enviado! Rastrear: ${c.link}`,
  4: (c) => `${c.name}, tu paquete salió de ${c.originCountry}. ${c.link}`,
  5: (c) => `${c.name}, tu pedido está en tránsito internacional. ${c.link}`,
  6: (c) => `${c.name}, tu paquete llegó a tu país! ${c.link}`,
  7: (c) => `${c.name}, tu paquete está en aduana. Sin acción necesaria. ${c.link}`,
  8: (c) => `${c.name}, liberado de la aduana! En tránsito local. ${c.link}`,
  9: (c) => `${c.name}, SALIO PARA ENTREGA hoy. Por favor disponible. ${c.link}`,
  10: (c) => `${c.name}, tu pedido fue entregado. Gracias! ${c.link}`,
};

export const EMAIL_TEMPLATES: Record<Lang, Record<number, EmailFn>> = {
  en: EMAIL_EN,
  es: EMAIL_ES,
};

export const SMS_TEMPLATES: Record<Lang, Record<number, SmsFn>> = {
  en: SMS_EN,
  es: SMS_ES,
};

// Step labels reused for the visual progress checklist in the email.
export const STEP_LABELS: Record<Lang, string[]> = {
  en: [
    "Order Received",
    "Order Prepared",
    "Shipped by Sender",
    "Left Country of Origin",
    "In International Transit",
    "Arrived at Destination Country",
    "In Customs Processing",
    "In Local Transit",
    "Out for Delivery",
    "Delivered",
  ],
  es: [
    "Pedido Recibido",
    "Pedido Preparado",
    "Enviado por el Remitente",
    "Salió del País de Origen",
    "En Tránsito Internacional",
    "Llegó al País de Destino",
    "En Procesamiento Aduanero",
    "En Tránsito Local",
    "Salió para Entrega",
    "Entregado",
  ],
};
