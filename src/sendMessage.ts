import instanceAxios from "./config/instanceAxios";

// Interfaces
interface infoSendMessage {
  dialogId: string;
  message: string;
  chatId: string;
  isLink?: boolean; // Añadido para diferenciar si el mensaje es un link
}

// Función para enviar mensajes
const sendMessage = async ({
  dialogId,
  message,
  chatId,
  isLink = false,
}: infoSendMessage) => {
  try {
    console.log("=== Entró a la función de sendMessage ===");
    console.log("dialogId:", dialogId);
    console.log("message:", message);
    console.log("chatId:", chatId);
    console.log("isLink:", isLink);
    console.log("=====================================");

    // Enviar mensaje al diálogo del cliente (DIALOG_ID)
    if (dialogId) {
      const webhook = "/imbot.message.add.json";
      console.log("Enviando mensaje al cliente a través de dialogId");

      const response = await instanceAxios.post(webhook, {
        BOT_ID: "1347",
        CLIENT_ID: "prba1jfxsc21fjvsgimuddxk4vqgmnr2",
        DIALOG_ID: dialogId,
        MESSAGE: message,
      });

      console.log("Respuesta del mensaje al cliente:", response.data);
    }

    // Verificar si debemos enviar el mensaje al Open Channel (CHAT_ID)
    if (chatId) {
      const webhookTransferToFreeAgent = `/imopenlines.bot.session.operator.json`;
      console.log("Enviando mensaje al Open Channel via chatId:", chatId);

      const transferResponse = await instanceAxios.post(
        webhookTransferToFreeAgent,
        {
          BOT_ID: "1347",
          CLIENT_ID: "prba1jfxsc21fjvsgimuddxk4vqgmnr2",
          CHAT_ID: chatId,
        }
      );

      console.log(
        "Respuesta del mensaje al Open Channel:",
        transferResponse.data
      );
    }

    // Si es un link, manejar la transferencia al Open Channel
    if (isLink && chatId) {
      const webhookLinkTransfer = "/imopenlines.bot.message.add.json";
      console.log("Enviando un enlace al Open Channel");

      const linkResponse = await instanceAxios.post(webhookLinkTransfer, {
        BOT_ID: "1347",
        CLIENT_ID: "prba1jfxsc21fjvsgimuddxk4vqgmnr2",
        CHAT_ID: chatId,
        MESSAGE: message,
      });

      console.log("Respuesta al enviar el enlace:", linkResponse.data);
    }
  } catch (error) {
    console.error("Error en sendMessage:", error);
  }
};

export default sendMessage;