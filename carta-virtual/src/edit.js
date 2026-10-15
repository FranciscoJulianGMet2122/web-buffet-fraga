import { db } from '../supabase.js';

console.log("Módulo de edición inicializado correctamente.");

// 1. Validar sesión de administrador
const usuarioSesion = JSON.parse(localStorage.getItem("usuarioLogueado"));
if (!usuarioSesion || usuarioSesion.rol !== 'admin') {
    alert("⛔ Acceso denegado.");
    window.location.replace("login.html");
}

// 2. Obtener el ID del producto desde los parámetros de la URL (?id=...)
const urlParams = new URLSearchParams(window.location.search);
const productoId = urlParams.get('id');

if (!productoId) {
    alert("⚠️ No se especificó ningún producto para editar.");
    window.location.replace("admin.html");
}

// Referencias a los elementos del formulario
const editForm = document.getElementById('editForm');
const editNombre = document.getElementById('editNombre');
const editPrecio = document.getElementById('editPrecio');
const editFoto = document.getElementById('editFoto');
const editDesc = document.getElementById('editDesc');
const editOpciones = document.getElementById('editOpciones');

// 3. Cargar los datos actuales del producto desde Supabase
async function cargarDatosProducto() {
    try {
        const { data, error } = await db
            .from('productos')
            .select('*')
            .eq('id', productoId)
            .single();

        if (error || !data) {
            console.error("Error al buscar producto:", error);
            alert("❌ No se pudo encontrar el producto en la base de datos.");
            window.location.replace("admin.html");
            return;
        }

        // Rellenar los inputs con la información actual
        editNombre.value = data.nombre || '';
        editPrecio.value = data.precio || '';
        editFoto.value = data.foto || '';
        editDesc.value = data.descripcion || '';
        editOpciones.value = data.opciones || '';

    } catch (err) {
        console.error("Excepción al cargar producto:", err);
    }
}

cargarDatosProducto();

// 4. Guardar los cambios actualizados en Supabase
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const nombre = editNombre.value.trim();
        const precio = parseFloat(editPrecio.value);
        const foto = editFoto.value.trim();
        const descripcion = editDesc.value.trim();
        const opciones = editOpciones.value.trim();

        if (!nombre || isNaN(precio) || precio <= 0) {
            alert("⚠️ Por favor, completá los campos obligatorios correctamente.");
            return;
        }

        try {
            const { error } = await db
                .from('productos')
                .update({
                    nombre,
                    precio,
                    foto,
                    descripcion,
                    opciones
                })
                .eq('id', productoId);

            if (error) {
                console.error("Error al actualizar:", error);
                alert("❌ Error al actualizar el producto: " + error.message);
            } else {
                alert("🎉 ¡Producto actualizado con éxito!");
                window.location.replace("admin.html");
            }
        } catch (err) {
            console.error("Excepción al actualizar:", err);
            alert("❌ Ocurrió un error inesperado al actualizar.");
        }
    });
}