// src/bitrix24.ts

import axios, { AxiosResponse } from "axios";

const BITRIX24_WEBHOOK_URL = process.env.API_BITRIX_URL; // Asegúrate de que termina con '/'

export interface Bitrix24ContactEmail {
  VALUE: string;
  VALUE_TYPE: string;
}

export interface Bitrix24Contact {
  ID: number;
  NAME: string;
  LAST_NAME: string;
  EMAIL: Bitrix24ContactEmail[];
  // Añade otros campos según tu configuración de Bitrix24
}

export interface Bitrix24ContactListResponse {
  result: Bitrix24Contact[];
}

export interface Bitrix24LeadCreateResponse {
  result: number; // ID del lead creado
}

/**
 * Busca un contacto en Bitrix24 por su correo electrónico.
 * @param email - El correo electrónico a buscar.
 * @returns El contacto si existe; de lo contrario, null.
 */
export async function findContactByEmail(
  email: string
): Promise<Bitrix24Contact | null> {
  try {
    const response: AxiosResponse<Bitrix24ContactListResponse> =
      await axios.get(`${BITRIX24_WEBHOOK_URL}/crm.contact.list`, {
        params: {
          FILTER: { EMAIL: email },
          SELECT: ["ID", "NAME", "LAST_NAME", "EMAIL"],
          ORDER: { ID: "DESC" },
        },
      });

    if (response.data.result && response.data.result.length > 0) {
      return response.data.result[0];
    }

    return null;
  } catch (error: any) {
    console.error(
      "Error al buscar contacto en Bitrix24:",
      error.response?.data || error.message
    );
    throw error;
  }
}

/**
 * Crea un nuevo lead en Bitrix24.
 * @param email - El correo electrónico del lead.
 * @returns El ID del lead creado.
 */
export async function createLead(email: string): Promise<number> {
  try {
    const leadData = {
      TITLE: "Nuevo Lead desde Chatbot",
      NAME: "Nombre", // Puedes personalizar esto o solicitar más información al usuario
      LAST_NAME: "Apellido",
      EMAIL: [
        {
          VALUE: email,
          VALUE_TYPE: "WORK",
        },
      ],
      STATUS_ID: "NEW",
      // Añade otros campos según tu configuración de Bitrix24
    };

    const response: AxiosResponse<Bitrix24LeadCreateResponse> =
      await axios.post(`${BITRIX24_WEBHOOK_URL}/crm.lead.add`, leadData);

    if (response.data.result) {
      return response.data.result;
    } else {
      throw new Error("No se pudo crear el lead en Bitrix24.");
    }
  } catch (error: any) {
    console.error(
      "Error al crear lead en Bitrix24:",
      error.response?.data || error.message
    );
    throw error;
  }
}