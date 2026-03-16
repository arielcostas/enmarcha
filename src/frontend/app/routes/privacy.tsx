import { usePageTitle } from "~/contexts/PageTitleContext";
import "../tailwind-full.css";

export default function Privacy() {
  usePageTitle("Política de privacidad");

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-3xl font-bold mb-2 text-text">
        Política de privacidad
      </h1>
      <p className="text-sm text-muted mb-8">
        Última actualización: 16 de marzo de 2026
      </p>

      {/* 1. Responsable */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          1. Responsable del tratamiento
        </h2>
        <p className="text-text opacity-90 leading-relaxed">
          El responsable del tratamiento de los datos personales recogidos a
          través de esta aplicación es:
        </p>
        <ul className="mt-3 space-y-1 text-text opacity-90 list-none ml-0">
          <li>
            <strong>Nombre:</strong> Ariel Costas Guerrero
          </li>
          <li>
            <strong>Correo de contacto:</strong>{" "}
            <a
              href="mailto:privacidad@enmarcha.app"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              privacidad@enmarcha.app
            </a>
          </li>
        </ul>
      </section>

      {/* 2. Datos tratados */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          2. Datos que recogemos y por qué
        </h2>
        <p className="text-text opacity-90 mb-4">
          Esta aplicación es un servicio de consulta de transporte público. No
          se crean cuentas de usuario ni se realiza ningún tipo de seguimiento
          publicitario.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-text border-collapse bg-surface rounded shadow overflow-hidden">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-3 font-semibold">Actividad</th>
                <th className="text-left p-3 font-semibold">Datos</th>
                <th className="text-left p-3 font-semibold">Base jurídica</th>
                <th className="text-left p-3 font-semibold">Conservación</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="p-3">Consulta de llegadas a una parada</td>
                <td className="p-3">Código de parada (no personal)</td>
                <td className="p-3">
                  Interés legítimo (prestación del servicio)
                </td>
                <td className="p-3">No se almacena</td>
              </tr>
              <tr className="border-b border-border bg-surface/40">
                <td className="p-3">Planificación de rutas</td>
                <td className="p-3">
                  Coordenadas de origen y destino, hora deseada
                </td>
                <td className="p-3">
                  Interés legítimo (prestación del servicio)
                </td>
                <td className="p-3">2 horas (caché local en tu dispositivo)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">
                  Geocodificación / geocodificación inversa
                </td>
                <td className="p-3">Coordenadas o texto de búsqueda</td>
                <td className="p-3">
                  Interés legítimo (prestación del servicio)
                </td>
                <td className="p-3">No se almacena en servidor</td>
              </tr>
              <tr className="border-b border-border bg-surface/40">
                <td className="p-3">
                  Paradas favoritas y nombres personalizados
                </td>
                <td className="p-3">
                  Identificadores de parada, nombres que tú asignas
                </td>
                <td className="p-3">
                  Acción del usuario (guardado voluntario)
                </td>
                <td className="p-3">Hasta que los borres tú</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">Paradas y lugares recientes</td>
                <td className="p-3">
                  Códigos de parada, coordenadas de búsquedas recientes
                </td>
                <td className="p-3">Interés legítimo (facilitar el uso)</td>
                <td className="p-3">Persistente hasta que los borres tú</td>
              </tr>
              <tr className="border-b border-border bg-surface/40">
                <td className="p-3">Ubicaciones de casa y trabajo</td>
                <td className="p-3">Dirección descriptiva y coordenadas</td>
                <td className="p-3">
                  Acción del usuario (configurado voluntariamente)
                </td>
                <td className="p-3">Hasta que los borres tú</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">Posición GPS del mapa</td>
                <td className="p-3">Coordenadas GPS de tu dispositivo</td>
                <td className="p-3">
                  Consentimiento (permiso de geolocalización del navegador)
                </td>
                <td className="p-3">
                  30 días (caché local; se descarta automáticamente)
                </td>
              </tr>
              <tr className="border-b border-border bg-surface/40">
                <td className="p-3">Registros operativos del servidor</td>
                <td className="p-3">
                  Dirección IP anonimizada, identificadores de parada/ruta
                </td>
                <td className="p-3">
                  Interés legítimo (operación y seguridad)
                </td>
                <td className="p-3">Rotación estándar de logs del servidor</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-3">Telemetría de rendimiento</td>
                <td className="p-3">
                  Identificadores de parada/ruta (sin coordenadas)
                </td>
                <td className="p-3">Interés legítimo (mejora del servicio)</td>
                <td className="p-3">Según configuración del colector OTLP</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 3. Geolocalización */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          3. Geolocalización
        </h2>
        <p className="text-text opacity-90 leading-relaxed">
          La aplicación puede solicitar acceso a tu ubicación GPS a través del
          permiso de geolocalización del navegador. Este acceso es opcional: si
          lo denegas, la aplicación seguirá funcionando sin centrar el mapa en
          tu posición.
        </p>
        <p className="mt-3 text-text opacity-90 leading-relaxed">
          Tus coordenadas <strong>no se transmiten al servidor</strong> salvo
          cuando usas el planificador de rutas para calcular un trayecto desde
          tu ubicación actual. En ese caso, las coordenadas se envían al
          servidor únicamente para procesar la consulta y no se almacenan.
        </p>
        <p className="mt-3 text-text opacity-90 leading-relaxed">
          La posición guardada localmente en tu dispositivo se descarta
          automáticamente tras 30 días.
        </p>
      </section>

      {/* 4. Almacenamiento local */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          4. Almacenamiento local (localStorage)
        </h2>
        <p className="text-text opacity-90 leading-relaxed">
          Esta aplicación utiliza el almacenamiento local del navegador (
          <code className="bg-surface px-1 rounded text-sm">localStorage</code>)
          para guardar tus preferencias, favoritos e historial de uso. Este
          almacenamiento <strong>nunca se comparte con terceros</strong> y es de
          carácter estrictamente funcional, no de seguimiento ni publicidad.
        </p>
        <p className="mt-3 text-text opacity-90 leading-relaxed">
          No se usan <em>cookies</em> de sesión ni de rastreo. La única
          excepción es la preferencia de idioma, que puede almacenarse tanto en{" "}
          <code className="bg-surface px-1 rounded text-sm">localStorage</code>{" "}
          como en una cookie de primer nivel para mantener la selección entre
          visitas.
        </p>
        <p className="mt-3 text-text opacity-90 leading-relaxed">
          Puedes eliminar todos los datos personales guardados localmente en
          cualquier momento desde{" "}
          <strong>
            Ajustes → Privacidad y datos → Borrar mis datos guardados
          </strong>
          .
        </p>
      </section>

      {/* 5. Encargados del tratamiento */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          5. Encargados y destinatarios del tratamiento
        </h2>
        <p className="text-text opacity-90 mb-4">
          Para prestar el servicio, algunas de tus consultas se transmiten a los
          siguientes terceros. En ningún caso se transfiere información que
          permita identificarte personalmente como usuario registrado, ya que la
          aplicación no tiene sistema de cuentas.
        </p>
        <ul className="space-y-3 text-text opacity-90 list-disc ml-5">
          <li>
            <strong>Geoapify</strong> (api.geoapify.com) — buscador de
            direcciones y geocodificación inversa. Recibe el texto de búsqueda o
            las coordenadas de la consulta. Política de privacidad:{" "}
            <a
              href="https://www.geoapify.com/privacy-policy"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              geoapify.com/privacy-policy
            </a>
          </li>
          <li>
            <strong>OpenTripPlanner</strong> — motor de planificación de rutas.
            Recibe las coordenadas de origen y destino y la hora del viaje.
          </li>
          <li>
            <strong>Vitrasa / Concello de Vigo</strong> (datos.vigo.org) — datos
            de llegadas en tiempo real para Vigo. Solo recibe el código numérico
            de la parada, y un resultado puede ser utilizado para varios
            usuarios, de modo que no se asocia a un individuo concreto.
          </li>
          <li>
            <strong>TUSSA</strong> (app.tussa.org) — datos de llegadas en tiempo
            real para Santiago de Compostela. Solo recibe el código de la
            parada, y un resultado puede ser utilizado para varios usuarios, de
            modo que no se asocia a un individuo concreto.
          </li>
          <li>
            <strong>Tranvías de A Coruña</strong> (itranvias.com) — datos de
            llegadas en tiempo real para A Coruña. Solo recibe el código de la
            parada, y un resultado puede ser utilizado para varios usuarios, de
            modo que no se asocia a un individuo concreto.
          </li>
          <li>
            <strong>Renfe GTFS-Realtime</strong> — feed público de posiciones de
            trenes. No se envían datos del usuario.
          </li>
        </ul>
      </section>

      {/* 6. Derechos */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          6. Tus derechos
        </h2>
        <p className="text-text opacity-90 mb-3 leading-relaxed">
          De acuerdo con el Reglamento General de Protección de Datos (RGPD) y
          la Ley Orgánica 3/2018 de Protección de Datos Personales y garantía de
          los derechos digitales (LOPDGDD), tienes derecho a:
        </p>
        <ul className="space-y-2 text-text opacity-90 list-disc ml-5">
          <li>
            <strong>Acceso</strong>: conocer qué datos tratamos sobre ti (los
            datos que mencionamos previamente).
          </li>
          <li>
            <strong>Rectificación</strong>: solicitar la corrección de datos
            inexactos (puedes hacerlo a través de la aplicación).
          </li>
          <li>
            <strong>Supresión</strong>: solicitar la eliminación de tus datos
            («derecho al olvido»). Los datos guardados en el dispositivo los
            debes eliminar manualmente, los datos en servidores se eliminan tras
            el periodo de consevación indicado, y no se pueden eliminar
            previamente por no ser asociados a un usuario concreto.
          </li>
          <li>
            <strong>Oposición</strong>: oponerte al tratamiento basado en
            interés legítimo. Dado que el tratamiento de datos en esta
            aplicación se basa principalmente en el interés legítimo para
            prestar el servicio, no es posible ejercer este derecho sin dejar de
            usar la aplicación, o las funciones que implican este tratamiento
            (planificador de rutas con "ubicación actual", por ejemplo).
          </li>
          <li>
            <strong>Portabilidad</strong>: recibir tus datos en un formato
            estructurado. Los datos están exclusivamente en el dispositivo,
            basta con acceder mediante las herramientas de desarrollo del
            navegador para copiarlos, o visualizarlos en la aplicación.
          </li>
          <li>
            <strong>Limitación</strong>: solicitar que restrinjamos el
            tratamiento de tus datos. Dado que la aplicación no almacena datos
            personales en servidores de forma persistente, este derecho se puede
            ejercer eliminando los datos desde la propia aplicación o dejando de
            usar las funciones que implican el tratamiento.
          </li>
        </ul>
        <p className="mt-4 text-text opacity-90 leading-relaxed">
          Dado que la aplicación no almacena datos personales en ningún servidor
          de forma persistente (todo lo personal reside en tu propio
          dispositivo), la mayoría de estos derechos los puedes ejercer
          directamente borrando los datos desde la propia aplicación (ver
          sección 4).
        </p>
        <p className="mt-3 text-text opacity-90 leading-relaxed">
          Para cualquier consulta o solicitud formal, puedes dirigirte a{" "}
          <a
            href="mailto:privacidad@enmarcha.app"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            privacidad@enmarcha.app
          </a>
          .
        </p>
      </section>

      {/* 7. AEPD */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          7. Derecho a reclamar ante la autoridad de control
        </h2>
        <p className="text-text opacity-90 leading-relaxed">
          Si consideras que el tratamiento de tus datos no se ajusta a la
          normativa vigente, puedes presentar una reclamación ante la{" "}
          <strong>Agencia Española de Protección de Datos (AEPD)</strong>:
        </p>
        <ul className="mt-3 space-y-1 text-text opacity-90 list-none ml-0">
          <li>
            Web:{" "}
            <a
              href="https://www.aepd.es"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              www.aepd.es
            </a>
          </li>
          <li>
            Sede electrónica:{" "}
            <a
              href="https://sedeagpd.gob.es"
              className="text-blue-600 dark:text-blue-400 hover:underline"
              rel="nofollow noreferrer noopener"
              target="_blank"
            >
              sedeagpd.gob.es
            </a>
          </li>
        </ul>
      </section>

      {/* 8. Cambios */}
      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4 border-b border-border pb-2 text-text">
          8. Cambios en esta política
        </h2>
        <p className="text-text opacity-90 leading-relaxed">
          Esta política puede actualizarse para reflejar cambios en la
          aplicación o en la normativa aplicable. La fecha de «Última
          actualización» indicada en la cabecera refleja la versión vigente. Te
          recomendamos revisarla periódicamente.
        </p>
      </section>
    </div>
  );
}
