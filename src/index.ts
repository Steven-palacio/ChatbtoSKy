// src/app.ts

import express from "express";
import sendMessage from "./sendMessage";

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware para parsear el cuerpo de las solicitudes como JSON y URL-encoded
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

interface PropertiesChatUsers {
  [key: string]: {
    step: string;
    data?: {
      email?: string;
      paymentInfo?: string;
      locator?: string; // Nueva propiedad añadida
      // Otras propiedades...
    };
  };
}

const chatsUsers: PropertiesChatUsers = {};

// Funciones auxiliares
function extractOptionNumber(message: string): string {
  const match = message.match(/^(\d+)/);
  if (match) {
    return match[1];
  }
  return "";
}

function getPlatform(chatEntityId: string): string {
  const parts = chatEntityId.split("|");
  const platformIdentifier = parts[0].toLowerCase();

  if (platformIdentifier.includes("instagram")) {
    return "instagram";
  } else if (platformIdentifier.includes("whatsapp")) {
    return "whatsapp";
  } else if (platformIdentifier.includes("livechat")) {
    return "livechat";
  } else {
    return "unknown";
  }
}

function generateResponse(
  baseMessage: string,
  options: string[],
  platform: string
): string {
  let response = baseMessage;

  switch (platform) {
    case "instagram":
      // Formato de botones para Instagram
      options.forEach((option) => {
        response += `\n${option}`;
      });
      break;

    case "whatsapp":
      // Formato de botones para WhatsApp
      options.forEach((option) => {
        response += `\n${option}`;
      });
      break;

    case "livechat":
      // Formato de botones para LiveChat
      options.forEach((option) => {
        response += `\n[send]${option}[/send]`;
      });
      break;

    default:
      // Formato por defecto
      options.forEach((option) => {
        response += `\n[send]${option}[/send]`;
      });
      break;
  }

  return response;
}

// Rutas
app.get("/", (req, res) => {
  res.send("¡Hola Ruta de prueba de servidor!");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.post("/webhook", async (req, res) => {
  const event = req.body;
  console.log("Evento recibido:", event); // Log para depuración

  const message: string = event.data.PARAMS.MESSAGE;
  const dialogId: string = event.data.PARAMS.DIALOG_ID;
  const chatId: string = event.data.PARAMS.CHAT_ID;
  const chatEntityId: string = event.data.PARAMS.CHAT_ENTITY_ID;

  console.log("Datos extraídos del evento:");
  console.log("Mensaje:", message);
  console.log("dialogId:", dialogId);
  console.log("chatId:", chatId);
  console.log("chatEntityId:", chatEntityId);

  const platform = getPlatform(chatEntityId);
  console.log("Plataforma detectada:", platform);

  try {
    if (event.event === "ONIMBOTMESSAGEADD") {
      // Normalizar el mensaje: minúsculas y sin acentos
      let normalizedMessage = message.trim().toLowerCase();
      normalizedMessage = normalizedMessage
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Eliminar acentos

      // Extraer el número de opción si está presente al inicio del mensaje
      const optionNumber = extractOptionNumber(normalizedMessage);
      normalizedMessage = normalizedMessage.replace(/[^a-z0-9 ]/g, "").trim();

      // Inicializar el estado del usuario si no existe
      if (!chatsUsers[dialogId]) {
        if (platform === "whatsapp") {
          // Para WhatsApp: Iniciar directamente en el paso 'welcome'
          chatsUsers[dialogId] = {
            step: "welcome",
          };

          // Enviar mensaje inicial y opciones
          const welcomeMessage =
            "Hola, gracias por comunicarte con nosotros. ¿En qué podemos asistirte? 😊";
          await sendMessage({ dialogId, message: welcomeMessage, chatId: "" });

          const welcomeOptions = [
            "1. Cambios a mi reserva. 🔄",
            "2. Pagar mi boleto. 💳",
            "3. Nueva reservación. 🛫",
          ];
          const welcomeResponse = generateResponse(
            "",
            welcomeOptions,
            platform
          );
          await sendMessage({
            dialogId,
            message: welcomeResponse,
            chatId: "",
          });
        } else {
          // Para otras plataformas: Iniciar en el paso 'ask_email'
          chatsUsers[dialogId] = {
            step: "ask_email",
          };

          // Enviar mensaje solicitando el correo electrónico
          const emailPrompt =
            "¡Hola! Gracias por comunicarte con nosotros. Por favor, proporciónanos tu correo electrónico para poder asistirte mejor. 📧";
          await sendMessage({ dialogId, message: emailPrompt, chatId: "" });
        }

        return res.status(200).send("OK");
      }

      const userState = chatsUsers[dialogId];

      // Manejar la lógica según el estado actual del usuario
      switch (userState.step) {
        case "ask_email":
          await handleAskEmailStep(
            normalizedMessage,
            message,
            userState,
            dialogId,
            chatId,
            platform
          );
          break;

        case "welcome":
          await handleWelcomeStep(
            normalizedMessage,
            optionNumber,
            userState,
            dialogId,
            chatId,
            platform
          );
          break;

        case "flight_changes":
          await handleFlightChangesStep(
            normalizedMessage,
            optionNumber,
            userState,
            dialogId,
            chatId,
            platform
          );
          break;

        case "enter_locator":
          await handleEnterLocatorStep(
            message,
            userState,
            dialogId,
            chatId,
            platform
          );
          break;

        case "payment_difficulties":
          await handlePaymentDifficultiesStep(
            message,
            userState,
            dialogId,
            chatId,
            platform
          );
          break;

        case "new_reservation":
          await handleNewReservationStep(
            normalizedMessage,
            optionNumber,
            userState,
            dialogId,
            chatId,
            platform
          );
          break;

        case "need_help":
          await handleNeedHelpStep(
            normalizedMessage,
            optionNumber,
            userState,
            dialogId,
            chatId,
            platform
          );
          break;

        default:
          // Reiniciar el flujo al estado 'welcome' si el estado actual no está reconocido
          chatsUsers[dialogId].step = "welcome";

          // Enviar mensaje inicial y opciones
          const defaultMessage =
            "Hola, gracias por comunicarte con nosotros. ¿En qué podemos asistirte? 😊";
          await sendMessage({ dialogId, message: defaultMessage, chatId: "" });

          const defaultOptions = [
            "1. Cambios a mi reserva. 🔄",
            "2. Pagar mi boleto. 💳",
            "3. Nueva reservación. 🛫",
          ];
          const defaultResponse = generateResponse(
            "",
            defaultOptions,
            platform
          );
          await sendMessage({
            dialogId,
            message: defaultResponse,
            chatId: "",
          });
          break;
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en el webhook:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// Funciones para manejar cada paso

/**
 * Maneja el paso 'ask_email' del flujo de conversación.
 * Solicita y almacena el correo electrónico del usuario.
 */
async function handleAskEmailStep(
  normalizedMessage: string,
  originalMessage: string,
  userState: PropertiesChatUsers[string],
  dialogId: string,
  chatId: string,
  platform: string
) {
  // Validar el formato del correo electrónico
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const email = originalMessage.trim();

  if (!emailRegex.test(email)) {
    const invalidEmailResponse =
      "⚠️ Por favor, proporciona un correo electrónico válido. 📧";
    await sendMessage({ dialogId, message: invalidEmailResponse, chatId: "" });
    return;
  }

  try {
    // Almacenar el correo electrónico en el estado del usuario
    userState.data = {
      email: email,
    };

    // Cambiar el estado a 'welcome' y enviar las opciones
    userState.step = "welcome";
    const welcomeMessage = "¡Gracias! Ahora, ¿en qué podemos asistirte? 😊";
    await sendMessage({ dialogId, message: welcomeMessage, chatId: "" });

    const options = [
      "1. Cambios a mi reserva. 🔄",
      "2. Pagar mi boleto. 💳",
      "3. Nueva reservación. 🛫",
    ];
    const response = generateResponse("", options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  } catch (error) {
    console.error("Error al procesar el correo electrónico:", error);
    const errorResponse =
      "Hubo un problema al procesar tu correo electrónico. Por favor, intenta nuevamente más tarde.";
    await sendMessage({ dialogId, message: errorResponse, chatId: "" });
  }
}

/**
 * Maneja el paso 'welcome' del flujo de conversación.
 */
async function handleWelcomeStep(
  normalizedMessage: string,
  optionNumber: string,
  userState: PropertiesChatUsers[string],
  dialogId: string,
  chatId: string,
  platform: string
) {
  if (
    optionNumber === "1" ||
    normalizedMessage.includes("cambios a mi reserva")
  ) {
    userState.step = "flight_changes";
    const responseBase =
      "¡Súper! 😄 ¿Tienes tu código de reserva o localizador?";
    const options = ["1. Sí, lo tengo. ✅", "2. No. ❌"];
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  } else if (
    optionNumber === "2" ||
    normalizedMessage.includes("pagar mi boleto")
  ) {
    userState.step = "payment_difficulties";
    const responseBase =
      "Nos sentimos honrados de que desees viajar con nosotros. ✈️\nPor favor, indícanos la ciudad de origen y destino, así como las fechas de tu viaje.";
    const options: string[] = []; // Sin botones específicos
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  } else if (
    optionNumber === "3" ||
    normalizedMessage.includes("nueva reservacion") ||
    normalizedMessage.includes("nueva reservación")
  ) {
    userState.step = "new_reservation";
    const responseBase =
      "¡Nos sentimos honrados de que desees viajar con nosotros! ☀️\n\nPuedes realizar tu reserva directamente desde nuestra página web: www.skyhighdo.com y seleccionar el destino y fecha que desees. 🛫";
    const options = ["1. ¡Okay, gracias! 😊", "2. Ya lo intenté. 🔄"];
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  } else {
    // Opción inválida, solicitar selección nuevamente
    const responseBase =
      "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
    const options = [
      "1. Cambios a mi reserva. 🔄",
      "2. Pagar mi boleto. 💳",
      "3. Nueva reservación. 🛫",
    ];
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  }
}

async function handleFlightChangesStep(
  normalizedMessage: string,
  optionNumber: string,
  userState: PropertiesChatUsers[string],
  dialogId: string,
  chatId: string,
  platform: string
) {
  if (
    optionNumber === "1" ||
    normalizedMessage.includes("si lo tengo") ||
    normalizedMessage.includes("sí lo tengo")
  ) {
    userState.step = "enter_locator";
    const responseBase = "¡Súper! Introduce tu número de localizador: ✈️";
    const options: string[] = []; // Sin botones específicos
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  } else if (optionNumber === "2" || normalizedMessage === "no") {
    userState.step = "end";
    const responseBase =
      "Entiendo. En unos momentos uno de nuestros representantes estará contigo. 👨‍💼";
    const options: string[] = []; // Sin botones específicos
    await sendMessage({ dialogId, message: responseBase, chatId });
    delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
  } else {
    // Opción inválida, solicitar selección nuevamente
    const responseBase =
      "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
    const options = ["1. Sí, lo tengo. ✅", "2. No. ❌"];
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  }
}

/**
 * Maneja el paso 'enter_locator' del flujo de conversación.
 * Esta versión incluye la búsqueda del deal y responde con los detalles encontrados.
 */
async function handleEnterLocatorStep(
  message: string,
  userState: PropertiesChatUsers[string],
  dialogId: string,
  chatId: string,
  platform: string
) {
  const locator = message.trim();
  console.log("Localizador recibido:", locator);
  userState.step = "end"; // Finalizamos el flujo después de procesar el localizador

  // Enviar la respuesta estática al usuario
  const responseBase =
    "Excelente, un representante estará contigo pronto. 👨‍💼😊";
  const response = generateResponse(responseBase, [], platform);
  await sendMessage({ dialogId, message: response, chatId });

  // Eliminar el estado del usuario
  delete chatsUsers[dialogId];
}

async function handlePaymentDifficultiesStep(
  message: string,
  userState: PropertiesChatUsers[string],
  dialogId: string,
  chatId: string,
  platform: string
) {
  // Procesamos la información proporcionada por el usuario
  userState.data = {
    paymentInfo: message.trim(),
  };
  userState.step = "end"; // Finalizamos el flujo o cambiamos al siguiente paso si lo hay

  // Enviamos una respuesta al usuario
  const responsePayment =
    "¡Gracias por la información! Un representante se comunicará contigo en breve para ayudarte con el pago de tu boleto. 👨‍💼";
  await sendMessage({ dialogId, message: responsePayment, chatId });

  // Eliminamos el estado del usuario si ya no es necesario
  delete chatsUsers[dialogId];
}

async function handleNewReservationStep(
  normalizedMessage: string,
  optionNumber: string,
  userState: PropertiesChatUsers[string],
  dialogId: string,
  chatId: string,
  platform: string
) {
  if (optionNumber === "1" || normalizedMessage.includes("okay gracias")) {
    userState.step = "end";
    const responseBase =
      "¡Estaremos aquí si necesitas ayuda! 😊\n¡Nos vemos a bordo! ✈️❤️";
    const response = generateResponse(responseBase, [], platform);
    await sendMessage({ dialogId, message: response, chatId });
    delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
  } else if (
    optionNumber === "2" ||
    normalizedMessage.includes("ya lo intente") ||
    normalizedMessage.includes("ya lo intenté")
  ) {
    userState.step = "need_help";
    const responseBase =
      "Entiendo ¡Ayuda en camino! 🚀\n\nMientras esperas por uno de nuestros héroes, compártenos con qué tuviste dificultad:";
    const options = [
      "1. Pagar mi reserva. 💳",
      "2. Fechas / Destinos 📅",
      "3. Otra cosa. ❓",
    ];
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  } else {
    // Opción inválida, solicitar selección nuevamente
    const responseBase =
      "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
    const options = ["1. ¡Okay, gracias! 😊", "2. Ya lo intenté. 🔄"];
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  }
}

async function handleNeedHelpStep(
  normalizedMessage: string,
  optionNumber: string,
  userState: PropertiesChatUsers[string],
  dialogId: string,
  chatId: string,
  platform: string
) {
  if (optionNumber === "1" || normalizedMessage.includes("pagar mi reserva")) {
    userState.step = "end";
    const responseBase =
      "¡Gracias! Tu opinión nos hace mejores. ☀️\n\nEl equipo de SKYhigh estará contigo en breves momentos. 👨‍💼";
    const response = generateResponse(responseBase, [], platform);
    await sendMessage({ dialogId, message: response, chatId });
    delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
  } else if (
    optionNumber === "2" ||
    normalizedMessage.includes("fechas") ||
    normalizedMessage.includes("destinos")
  ) {
    userState.step = "end";
    const responseBase =
      "¡Gracias! Tu opinión nos hace mejores. ☀️\n\nEl equipo de SKYhigh estará contigo en breves momentos. 👨‍💼";
    const response = generateResponse(responseBase, [], platform);
    await sendMessage({ dialogId, message: response, chatId });
    delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
  } else if (optionNumber === "3" || normalizedMessage.includes("otra cosa")) {
    userState.step = "end";
    const responseBase =
      "¡Gracias! Tu opinión nos hace mejores. ☀️\n\nEl equipo de SKYhigh estará contigo en breves momentos. 👨‍💼";
    const response = generateResponse(responseBase, [], platform);
    await sendMessage({ dialogId, message: response, chatId });
    delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
  } else {
    // Opción inválida, solicitar selección nuevamente
    const responseBase =
      "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
    const options = [
      "1. Pagar mi reserva. 💳",
      "2. Fechas / Destinos 📅",
      "3. Otra cosa. ❓",
    ];
    const response = generateResponse(responseBase, options, platform);
    await sendMessage({ dialogId, message: response, chatId: "" });
  }
}

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});


/////////////////////////////////////////////////////////////////////////////////////////////////////

/* Codigo de reserva de funcionalidad de buscar el localizador  */

/* 
import express from "express";
import bodyParser from "body-parser";
import sendMessage from "./sendMessage";
import getDealByLocator from "./getDealByLocator";

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware para parsear el cuerpo de las solicitudes como JSON
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

interface PropertiesChatUsers {
  [key: string]: {
    step: string;
    data?: any; // Para almacenar datos temporales del usuario
  };
}

const chatsUsers: PropertiesChatUsers = {};

// Función para extraer el número de opción del mensaje del usuario
function extractOptionNumber(message: string): string {
  const match = message.match(/^(\d+)/);
  if (match) {
    return match[1];
  }
  return "";
}

// Función para determinar la plataforma
function getPlatform(chatEntityId: string): string {
  const parts = chatEntityId.split("|");
  const platformIdentifier = parts[0].toLowerCase();

  if (platformIdentifier.includes("instagram")) {
    return "instagram";
  } else if (platformIdentifier.includes("whatsapp")) {
    return "whatsapp";
  } else if (platformIdentifier.includes("livechat")) {
    return "livechat";
  } else {
    return "unknown";
  }
}

// Función para generar mensajes con botones según la plataforma
function generateResponse(
  baseMessage: string,
  options: string[],
  platform: string
): string {
  let response = baseMessage;

  switch (platform) {
    case "instagram":
      // Formato de botones para Instagram
      options.forEach((option) => {
        response += `\n${option}`;
      });
      break;

    case "whatsapp":
      // Formato de botones para WhatsApp
      options.forEach((option) => {
        response += `\n${option}`;
      });
      break;

    case "livechat":
      // Formato de botones para LiveChat (usando [send] como en tu implementación actual)
      options.forEach((option) => {
        response += `\n[send]${option}[/send]`;
      });
      break;

    default:
      // Formato por defecto si la plataforma no es reconocida
      options.forEach((option) => {
        response += `\n[send]${option}[/send]`;
      });
      break;
  }

  return response;
}

app.get("/", (req, res) => {
  res.send("¡Hola Ruta de prueba de servidor!");
});

// Ruta de comprobación de salud
app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

// Ruta para recibir los webhooks
app.post("/webhook", async (req, res) => {
  const event = req.body;
  console.log("Evento recibido:", event); // Verifica la estructura del evento recibido

  const message: string = event.data.PARAMS.MESSAGE;
  const dialogId: string = event.data.PARAMS.DIALOG_ID;
  const chatId: string = event.data.PARAMS.CHAT_ID;
  const chatEntityId: string = event.data.PARAMS.CHAT_ENTITY_ID;

  console.log("Datos extraídos del evento:");
  console.log("Mensaje:", message);
  console.log("dialogId:", dialogId);
  console.log("chatId:", chatId);
  console.log("chatEntityId:", chatEntityId);

  // Determinar la plataforma
  const platform = getPlatform(chatEntityId);
  console.log("Plataforma detectada:", platform);

  try {
    if (event.event === "ONIMBOTMESSAGEADD") {
      let normalizedMessage = message.trim().toLowerCase();
      normalizedMessage = normalizedMessage
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, ""); // Elimina acentos

      // Extraer el número de opción si está presente al inicio del mensaje
      const optionNumber = extractOptionNumber(normalizedMessage);

      // Remover puntuación y espacios adicionales
      normalizedMessage = normalizedMessage.replace(/[^a-z0-9 ]/g, "").trim();

      // Inicializar el estado del usuario si no existe
      if (!chatsUsers[dialogId]) {
        chatsUsers[dialogId] = {
          step: "welcome",
        };

        // Enviar mensaje inicial y opciones por separado
        const initialMessage =
          "Hola, gracias por comunicarte con nosotros. ¿En qué podemos asistirte? 😊";
        await sendMessage({ dialogId, message: initialMessage, chatId: "" });

        const options = [
          "1. Cambios a mi reserva. 🔄",
          "2. Pagar mi boleto. 💳",
          "3. Nueva reservación. 🛫",
        ];
        const response = generateResponse("", options, platform);
        await sendMessage({ dialogId, message: response, chatId: "" });

        // Salir del procesamiento adicional para esperar la respuesta del usuario
        return res.status(200).send("OK");
      }

      const userState = chatsUsers[dialogId];

      // Manejar cada paso según el estado del usuario
      switch (userState.step) {
        case "welcome":
          if (
            optionNumber === "1" ||
            normalizedMessage.includes("cambios a mi reserva")
          ) {
            userState.step = "flight_changes";
            const responseBase =
              "¡Súper! 😄 ¿Tienes tu código de reserva o localizador?";
            const options = ["1. Sí, lo tengo. ✅", "2. No. ❌"];
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          } else if (
            optionNumber === "2" ||
            normalizedMessage.includes("pagar mi boleto")
          ) {
            userState.step = "payment_difficulties";
            const responseBase =
              "Nos sentimos honrados de que desees viajar con nosotros. ✈️\nPor favor, indícanos la ciudad de origen y destino, así como las fechas de tu viaje.";
            const options: string[] = []; // Sin botones específicos
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          } else if (
            optionNumber === "3" ||
            normalizedMessage.includes("nueva reservacion") ||
            normalizedMessage.includes("nueva reservación")
          ) {
            userState.step = "new_reservation";
            const responseBase =
              "¡Nos sentimos honrados de que desees viajar con nosotros! ☀️\n\nPuedes realizar tu reserva directamente desde nuestra página web: www.skyhighdo.com y seleccionar el destino y fecha que desees. 🛫";
            const options = ["1. ¡Okay, gracias! 😊", "2. Ya lo intenté. 🔄"];
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          } else {
            const responseBase =
              "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
            const options = [
              "1. Cambios a mi reserva. 🔄",
              "2. Pagar mi boleto. 💳",
              "3. Nueva reservación. 🛫",
            ];
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          }
          break;

        case "flight_changes":
          if (
            optionNumber === "1" ||
            normalizedMessage.includes("si lo tengo") ||
            normalizedMessage.includes("sí lo tengo")
          ) {
            userState.step = "enter_locator";
            const responseBase =
              "¡Súper! Introduce tu número de localizador: ✈️";
            const options: string[] = []; // Sin botones específicos
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          } else if (optionNumber === "2" || normalizedMessage === "no") {
            userState.step = "end";
            const responseBase =
              "Entiendo. En unos momentos uno de nuestros representantes estará contigo. 👨‍💼";
            const options: string[] = []; // Sin botones específicos
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId });
            delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
          } else {
            const responseBase =
              "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
            const options = ["1. Sí, lo tengo. ✅", "2. No. ❌"];
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          }
          break;

        case "enter_locator":
          const locator = message.trim();
          console.log("Localizador recibido:", locator);
          userState.step = "end"; // Finalizamos el flujo después de procesar el localizador
          try {
            const deal = await getDealByLocator(locator);

            if (deal) {
              const dealLink = `https://demo-egconnects.bitrix24.com/crm/deal/details/${deal.ID}/`;

              // Verificamos si tenemos fechas y destinos disponibles
              const flightDate = deal.UF_CRM_1723822712 || "No disponible";
              const returnDate = deal.UF_CRM_1724703440 || "No disponible";
              const destination = deal.UF_CRM_1724703908 || "No disponible";
              const origin = deal.UF_CRM_1724703943 || "No disponible";

              let responseBase = `¡Genial! 🎉 He encontrado tu reserva. 🛫\n\nTítulo: ${deal.TITLE}\nFecha de salida: ${flightDate}\nFecha de retorno: ${returnDate}\nOrigen: ${origin}\nDestino: ${destination}\n\n`;

              // Envía el mensaje sin el link al cliente
              console.log("Reserva encontrada:", deal);
              const response = generateResponse(responseBase, [], platform);
              await sendMessage({ dialogId, message: response, chatId: "" });

              const messageReservation =
                "Un representante estará contigo pronto. 👨‍💼 😊";
              await sendMessage({
                dialogId,
                message: messageReservation,
                chatId: "",
              });

              // Envía el link solo al contact center
              const responseWithLink = `Aquí está la información del deal: ${dealLink}`;
              console.log("Enviando link al contact center:", responseWithLink);
              await sendMessage({
                dialogId: "",
                message: responseWithLink,
                chatId,
                isLink: true,
              });
            } else {
              const responseBase =
                "Lo siento mucho 😔, no pude encontrar ninguna reserva con ese código. Por favor verifica e intenta nuevamente. En unos momentos uno de nuestros representantes estará contigo. 👨‍💼";
              console.log(
                "No se encontró reserva con el localizador:",
                locator
              );
              const response = generateResponse(responseBase, [], platform);
              await sendMessage({ dialogId, message: response, chatId });
            }
            delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
          } catch (error) {
            const responseBase =
              "Hubo un problema al buscar tu reserva. Inténtalo más tarde.";
            console.error("Error al buscar el deal:", error);
            const response = generateResponse(responseBase, [], platform);
            await sendMessage({ dialogId, message: response, chatId });
            delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
          }
          break;

        case "payment_difficulties":
          // Procesamos la información proporcionada por el usuario
          userState.data = {
            paymentInfo: message.trim(),
          };
          userState.step = "end"; // Finalizamos el flujo o cambiamos al siguiente paso si lo hay

          // Enviamos una respuesta al usuario
          const responsePayment =
            "¡Gracias por la información! Un representante se comunicará contigo en breve para ayudarte con el pago de tu boleto. 👨‍💼";
          await sendMessage({ dialogId, message: responsePayment, chatId });

          // Eliminamos el estado del usuario si ya no es necesario
          delete chatsUsers[dialogId];
          break;

        case "new_reservation":
          if (
            optionNumber === "1" ||
            normalizedMessage.includes("okay gracias")
          ) {
            userState.step = "end";
            const responseBase =
              "¡Estaremos aquí si necesitas ayuda! 😊\n¡Nos vemos a bordo! ✈️❤️";
            const response = generateResponse(responseBase, [], platform);
            await sendMessage({ dialogId, message: response, chatId });
            delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
          } else if (
            optionNumber === "2" ||
            normalizedMessage.includes("ya lo intente") ||
            normalizedMessage.includes("ya lo intenté")
          ) {
            userState.step = "need_help";
            const responseBase =
              "Entiendo ¡Ayuda en camino! 🚀\n\nMientras esperas por uno de nuestros héroes, compártenos con qué tuviste dificultad:";
            const options = [
              "1. Pagar mi reserva. 💳",
              "2. Fechas / Destinos 📅",
              "3. Otra cosa. ❓",
            ];
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId });
          } else {
            const responseBase =
              "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
            const options = ["1. ¡Okay, gracias! 😊", "2. Ya lo intenté. 🔄"];
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          }
          break;

        case "need_help":
          if (
            optionNumber === "1" ||
            normalizedMessage.includes("pagar mi reserva")
          ) {
            userState.step = "end";
            const responseBase =
              "¡Gracias! Tu opinión nos hace mejores. ☀️\n\nEl equipo de SKYhigh estará contigo en breves momentos. 👨‍💼";
            const response = generateResponse(responseBase, [], platform);
            await sendMessage({ dialogId, message: response, chatId });
            delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
          } else if (
            optionNumber === "2" ||
            normalizedMessage.includes("fechas") ||
            normalizedMessage.includes("destinos")
          ) {
            userState.step = "end";
            const responseBase =
              "¡Gracias! Tu opinión nos hace mejores. ☀️\n\nEl equipo de SKYhigh estará contigo en breves momentos. 👨‍💼";
            const response = generateResponse(responseBase, [], platform);
            await sendMessage({ dialogId, message: response, chatId });
            delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
          } else if (
            optionNumber === "3" ||
            normalizedMessage.includes("otra cosa")
          ) {
            userState.step = "end";
            const responseBase =
              "¡Gracias! Tu opinión nos hace mejores. ☀️\n\nEl equipo de SKYhigh estará contigo en breves momentos. 👨‍💼";
            const response = generateResponse(responseBase, [], platform);
            await sendMessage({ dialogId, message: response, chatId });
            delete chatsUsers[dialogId]; // Eliminamos el estado del usuario
          } else {
            const responseBase =
              "⚠️ Por favor, selecciona una de las opciones proporcionadas:";
            const options = [
              "1. Pagar mi reserva. 💳",
              "2. Fechas / Destinos 📅",
              "3. Otra cosa. ❓",
            ];
            const response = generateResponse(responseBase, options, platform);
            await sendMessage({ dialogId, message: response, chatId: "" });
          }
          break;

        default:
          // Reiniciamos el flujo al estado "welcome" (flujo por defecto)
          chatsUsers[dialogId].step = "welcome";
          // Enviar mensaje inicial y opciones por separado
          const defaultMessage =
            "Hola, gracias por comunicarte con nosotros. ¿En qué podemos asistirte? 😊";
          await sendMessage({ dialogId, message: defaultMessage, chatId: "" });

          const defaultOptions = [
            "1. Cambios a mi reserva. 🔄",
            "2. Pagar mi boleto. 💳",
            "3. Nueva reservación. 🛫",
          ];
          const defaultResponse = generateResponse(
            "",
            defaultOptions,
            platform
          );
          await sendMessage({
            dialogId,
            message: defaultResponse,
            chatId: "",
          });
          break;
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("Error en el webhook:", error);
    res.status(500).send("Error interno del servidor");
  }
});

// Iniciar el servidor
app.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
}); */