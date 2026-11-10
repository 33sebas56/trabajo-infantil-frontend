Sistema de información sobre trabajo infantil en Pasto

Aplicación web para consultar información estadística sobre trabajo infantil a partir de archivos del Departamento Administrativo Nacional de Estadística (DANE). El sistema permite procesar archivos, revisar los resultados y publicar la información disponible para su consulta por periodo, edad y sexo.

Funcionalidades

Consulta pública de indicadores, tablas y gráficas.

Filtros por periodo, edad y sexo.

Comparación de resultados entre años disponibles.

Mapa de referencia de la ubicación de Pasto.

Acceso administrativo para cargar un archivo CSV, revisar sus resultados y errores, y publicar la carga.

Historial de cargas y consulta de la carga vigente de cada periodo.

La consulta pública no requiere una cuenta. El acceso administrativo requiere credenciales previamente configuradas; no hay registro público de administradores.

Datos y alcance

La fuente utilizada es el módulo de trabajo infantil de la Gran Encuesta Integrada de Hogares del DANE. La aplicación procesa los registros identificados con el código de área 52, utilizado por el sistema para Pasto, y considera la información disponible para personas entre 5 y 17 años.

Los archivos compartidos hasta el momento corresponden al cuarto trimestre de distintos años. La disponibilidad en la aplicación depende de las cargas que hayan sido procesadas y publicadas. Si faltan campos necesarios para un indicador, este puede mostrarse como no disponible; no se reemplaza por un cero.

El número de registros es la muestra procesada. Los porcentajes se calculan con factores de expansión y representan estimaciones. Las respuestas afirmativas a las preguntas laborales procesadas no equivalen por sí solas a la tasa oficial de trabajo infantil. El mapa muestra una ubicación de referencia; no presenta resultados por comuna.

Tecnologías

Componente

Tecnologías

Interfaz

Vue 3, TypeScript, Vite y Vue Router

Servidor

Java 21, Spring Boot 4.1.2, Spring Security y Spring Data JPA

Base de datos

PostgreSQL y migraciones con Flyway

Archivos y mapa

Apache Commons CSV, Leaflet y OpenStreetMap

Organización general

Los proyectos del servidor y de la interfaz se trabajan por separado:

trabajo-infantil/ Backend Spring Boot
trabajo-infantil-frontend/ Frontend Vue

En el backend, el código Java se encuentra en src/main/java/com/pasto/trabajo_infantil y las migraciones en src/main/resources/db/migration. En el frontend, src/views contiene las páginas, src/components los componentes reutilizables y src/services las llamadas al servidor.

Requisitos

Java 21.

Node.js y npm compatibles con las dependencias instaladas del frontend.

PostgreSQL en funcionamiento.

Navegador web actualizado.

El proyecto incluye el wrapper de Maven, por lo que no es indispensable instalar Maven por separado. La descarga inicial de dependencias requiere conexión a internet.

Configuración y ejecución local

1. Base de datos

Crear una base de datos llamada trabajo_infantil en PostgreSQL, únicamente si todavía no existe. Configurar la conexión y las credenciales en el entorno del backend o en src/main/resources/application.properties. No subir contraseñas reales al repositorio.

Las propiedades de conexión son spring.datasource.url, spring.datasource.username y spring.datasource.password. Al iniciar el backend, Flyway aplica las migraciones pendientes; no es necesario ejecutar manualmente las migraciones ya aplicadas.

2. Backend

En PowerShell, desde la carpeta trabajo-infantil:

.\mvnw.cmd spring-boot:run

La configuración local utilizada durante el desarrollo expone el servidor en http://localhost:8080.

3. Frontend

En otra terminal, desde la carpeta trabajo-infantil-frontend:

npm.cmd install
npm.cmd run dev

Abrir la dirección que indique Vite en la terminal; habitualmente es http://localhost:5173. El backend debe estar en ejecución para consultar o administrar los datos.

La versión compartida del frontend utiliza la dirección del servidor configurada en src/services/api.ts. Antes de publicar la aplicación, revisar esa dirección y el origen permitido por el backend. localhost solo apunta al equipo desde el cual se abre la página y no sirve como dirección pública del servidor.

Acceso administrativo

Ingresar desde Acceso administrativo con una cuenta existente. En la primera instalación, si no hay administradores, la creación inicial depende de la configuración del servidor. El inicializador no crea una cuenta adicional cuando ya existe un administrador.

Para cargar información, seleccionar un CSV, verificar el año y trimestre, confirmar el periodo y procesar el archivo. Después se deben revisar los resultados y errores antes de solicitar su publicación. Procesar una carga no la publica automáticamente.

Documentación

Manual técnico: componentes, configuración, procesamiento, seguridad y mantenimiento.

Manual de usuario: consulta pública, comparación de años y administración de cargas.

Estado de despliegue

La configuración documentada corresponde al entorno local. El despliegue requiere definir el alojamiento, las direcciones públicas, la conexión segura a PostgreSQL y la configuración de sesión y CORS. No se incluye una URL pública porque todavía no se ha confirmado.
