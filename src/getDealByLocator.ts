import instanceAxios from "./config/instanceAxios";

// Interfaces
interface Deal {
  [x: string]: any;
  ID: string;
  TITLE: string;
  UF_CRM_1724708436: string; // Campo del localizador
  STATUS: string;
  UF_CRM_1723822712: string; // Fecha que desea viajar
  UF_CRM_1724703440: string; // Fecha de retorno
  UF_CRM_1724703908: string; // Destino
  UF_CRM_1724703943: string; // Origen
}

// Opciones de destino y origen (basado en tu estructura proporcionada)
const destinationOptions = [
  { ID: "291", VALUE: "Anguila (AXA)" },
  { ID: "293", VALUE: "Antigua (ANU)" },
  { ID: "295", VALUE: "Aruba (AUA)" },
  { ID: "297", VALUE: "Bonaire (BON)" },
  { ID: "299", VALUE: "Caracas (CCS)" },
  { ID: "301", VALUE: "Curazao (CUR)" },
  { ID: "303", VALUE: "Georgetown (GEO)" },
  { ID: "305", VALUE: "Guadalupe (PTP)" },
  { ID: "307", VALUE: "La Habana (HAV)" },
  { ID: "309", VALUE: "Martinica (FDF)" },
  { ID: "311", VALUE: "Miami (MIA)" },
  { ID: "313", VALUE: "Santiago de Cuba (SCU)" },
  { ID: "315", VALUE: "Santo Domingo (SDQ)" },
  { ID: "317", VALUE: "St. Kitts (SKB)" },
  { ID: "319", VALUE: "Valencia (VLN)" },
];

const originOptions = [
  { ID: "321", VALUE: "Anguila (AXA)" },
  { ID: "323", VALUE: "Antigua (ANU)" },
  { ID: "325", VALUE: "Aruba (AUA)" },
  { ID: "327", VALUE: "Bonaire (BON)" },
  { ID: "329", VALUE: "Caracas (CCS)" },
  { ID: "331", VALUE: "Cayenne Guyana Francesa (CAY)" },
  { ID: "333", VALUE: "Curazao (CUR)" },
  { ID: "335", VALUE: "Georgetown (GEO)" },
  { ID: "337", VALUE: "Guadalupe (PTP)" },
  { ID: "339", VALUE: "La Habana (HAV)" },
  { ID: "341", VALUE: "Martinica (FDF)" },
  { ID: "343", VALUE: "Miami (MIA)" },
  { ID: "345", VALUE: "Santiago de Cuba (SCU)" },
  { ID: "347", VALUE: "Santo Domingo (SDQ)" },
  { ID: "349", VALUE: "St. Kitts (SKB)" },
  { ID: "351", VALUE: "Valencia (VLN)" },
];

// Función para mapear los IDs a los valores textuales
const mapSelectValue = (
  options: Array<{ ID: string; VALUE: string }>,
  id: string
): string => {
  const option = options.find((item) => item.ID === id);
  return option ? option.VALUE : "Valor no encontrado";
};

// Función para formatear una fecha en formato legible
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  if (!isNaN(date.getTime())) {
    // Formato: DD/MM/YYYY
    return `${date.getDate().toString().padStart(2, "0")}/${(
      date.getMonth() + 1
    )
      .toString()
      .padStart(2, "0")}/${date.getFullYear()}`;
  }
  return dateString; // Si no es una fecha válida, devolvemos el valor original
};

interface Bitrix24Response {
  result: Deal[];
  next?: number; // Campo que indica si hay más páginas
}

// Función para obtener el deal por el código de localizador específico, con paginación
const getDealByLocator = async (locator: string): Promise<Deal | null> => {
  let start = 0;

  try {
    // Bucle para paginar los resultados de Bitrix24
    while (true) {
      // Hacemos la petición a Bitrix24 para buscar el deal por el campo personalizado UF_CRM_1724708436
      const response = await instanceAxios.post<Bitrix24Response>(
        "/crm.deal.list.json",
        {
          filter: { UF_CRM_1724708436: locator }, // Filtro para buscar por el localizador actualizado
          select: [
            "ID",
            "TITLE",
            "UF_CRM_1724708436", // Campo del localizador
            "STATUS",
            "UF_CRM_1723822712", // Fecha que desea viajar
            "UF_CRM_1724703440", // Fecha de retorno
            "UF_CRM_1724703908", // Destino
            "UF_CRM_1724703943", // Origen
          ], // Campos a seleccionar
          start, // Paginación, comenzamos desde `start`
        }
      );

      const deals = response.data.result;

      // Si encontramos el deal, lo devolvemos
      if (deals.length > 0) {
        const dealFound = deals.find(
          (deal) => deal.UF_CRM_1724708436 === locator
        );
        if (dealFound) {
          // Formateamos las fechas antes de devolver el deal
          dealFound.UF_CRM_1723822712 = formatDate(dealFound.UF_CRM_1723822712); // Fecha que desea viajar
          dealFound.UF_CRM_1724703440 = formatDate(dealFound.UF_CRM_1724703440); // Fecha de retorno

          // Mapeamos los valores de Destino y Origen
          dealFound.UF_CRM_1724703908 = mapSelectValue(
            destinationOptions,
            dealFound.UF_CRM_1724703908
          ); // Destino
          dealFound.UF_CRM_1724703943 = mapSelectValue(
            originOptions,
            dealFound.UF_CRM_1724703943
          ); // Origen

          return dealFound; // Retornamos el deal encontrado con las fechas formateadas y los demás campos
        }
      }

      // Verificamos si hay más páginas
      if (response.data.next) {
        start = response.data.next; // Actualizamos el punto de inicio para la próxima página
      } else {
        break; // No hay más páginas, terminamos el bucle
      }
    }

    return null; // Si no se encuentra el deal, devolvemos null
  } catch (error) {
    console.error("Error al obtener el deal:", error);
    throw new Error("Error al obtener el deal.");
  }
};

export default getDealByLocator;