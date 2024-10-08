import { Boom } from "@hapi/boom";
import makeWASocket, {
    useMultiFileAuthState,
    isJidBroadcast,
    DisconnectReason,
    downloadMediaMessage,
    WA_DEFAULT_EPHEMERAL,
} from "@whiskeysockets/baileys";

// import pino from "pino";

const groups = ["120363317058483225@g.us"];

async function createWhatsAppConnection() {
    const { state, saveCreds } = await useMultiFileAuthState(
        "baileys_auth_info"
    );

    const sock = makeWASocket({
        printQRInTerminal: true,
        auth: state,
        shouldIgnoreJid: (jid) => isJidBroadcast(jid),
        // logger: pino({ level: "silent" }),
        generateHighQualityLinkPreview: true,
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === "close") {
            const shouldReconnect =
                (lastDisconnect?.error as Boom)?.output?.statusCode !==
                DisconnectReason.loggedOut;
            if (shouldReconnect) {
                createWhatsAppConnection();
            } else {
                console.log("connection error sending alert email");
            }
        }
    });
    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("messages.upsert", async (props) => {
        try {
            const msg = props.messages[0];

            if (groups.includes(msg.key.remoteJid as string)) {
                if (
                    msg.message?.imageMessage?.caption == "/s" ||
                    msg.message?.videoMessage?.caption == "/s"
                ) {
                    const media = await downloadMediaMessage(msg, "buffer", {
                        options: {},
                    });

                    await sock.sendMessage(
                        msg.key.remoteJid as string,
                        {
                            sticker: media,
                        },
                        {
                            quoted: msg,
                            ephemeralExpiration: WA_DEFAULT_EPHEMERAL,
                        }
                    );
                }
            }
        } catch (error) {
            console.log(error);
        }
    });
}

createWhatsAppConnection();
