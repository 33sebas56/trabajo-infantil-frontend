const URL_BACKEND = import.meta.env.VITE_API_URL || 'http://localhost:8080'

export class ErrorApi extends Error {
  estado: number
  datos: unknown

  constructor(mensaje: string, estado: number, datos: unknown = null) {
    super(mensaje)

    this.name = 'ErrorApi'
    this.estado = estado
    this.datos = datos
  }
}

type RespuestaError = {
  mensaje?: string
  message?: string
  mensajeResultado?: string | null
}

function obtenerMensajeError(respuesta: unknown, estado: number): string {
  if (typeof respuesta === 'object' && respuesta !== null) {
    const error = respuesta as RespuestaError

    if (typeof error.mensaje === 'string' && error.mensaje) {
      return error.mensaje
    }

    if (typeof error.message === 'string' && error.message) {
      return error.message
    }

    if (typeof error.mensajeResultado === 'string' && error.mensajeResultado) {
      return error.mensajeResultado
    }
  }

  return `La solicitud no pudo completarse. Código: ${estado}.`
}

export async function solicitarApi<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response

  try {
    respuesta = await fetch(`${URL_BACKEND}${ruta}`, {
      ...opciones,

      // Permite enviar y recibir la cookie de sesión.
      credentials: 'include',
    })
  } catch {
    throw new Error(
      'No fue posible conectar con el servidor. Verifica que el backend esté disponible.',
    )
  }

  const contenido = await respuesta.text()

  let datos: unknown = null

  if (contenido) {
    try {
      datos = JSON.parse(contenido)
    } catch {
      datos = contenido
    }
  }

  if (!respuesta.ok) {
    throw new ErrorApi(obtenerMensajeError(datos, respuesta.status), respuesta.status, datos)
  }

  return datos as T
}
