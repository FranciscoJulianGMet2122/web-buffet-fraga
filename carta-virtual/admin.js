import { db } from './supabase.js';

console.log("==========================================");
console.log("INICIALIZANDO MÓDULO DE ADMINISTRACIÓN COMPLETO");
console.log("==========================================");

// ==========================================
// 1. VERIFICACIÓN Y AUTENTICACIÓN DE ROL
// ==========================================
const validarSesionAdministrativa = () => {
    try {
        const sesionString = localStorage.getItem("usuarioLogueado");
        
        if (!sesionString) {
            console.warn("⚠️ Intento de navegación sin sesión detectado.");
            alert("⛔ Sesión no encontrada. Por favor inicie sesión.");
            window.location.replace("login.html");
            return false;
        }

        const usuario = JSON.parse(sesionString);

        if (!usuario.rol || usuario.rol !== 'admin') {
            console.warn(`⛔ Acceso rechazado para el correo: ${usuario.email} (Rol actual: ${usuario.rol})`);
            alert("⛔ Acceso restringido. Requiere cuenta con perfil Administrador.");
            window.location.replace("index.html");
            return false;
        }

        console.log(`✅ Sesión autorizada correctamente para el administrador: ${usuario.email}`);
        return true;
    } catch (err) {
        console.error("❌ Excepción al validar sesión activa:", err);
        window.location.replace("login.html");
        return false;
    }
};

if (!validarSesionAdministrativa()) {
    throw new Error("Ejecución detenida por falta de permisos administrativos.");
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm("¿Está seguro de que desea cerrar la sesión administrativa?")) {
            console.log("🚪 Finalizando sesión de administrador...");
            localStorage.removeItem("usuarioLogueado");
            window.location.replace("login.html");
        }
    });
}

// ==========================================
// 2. REFERENCIAS A COMPONENTES DEL DOM
// ==========================================
const productosTableBody = document.getElementById('productosTableBody');
const productForm = document.getElementById('productForm');
const editModal = document.getElementById('editModal');
const editForm = document.getElementById('editForm');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelEditBtn = document.getElementById('cancelEditBtn');

// ==========================================
// 3. PARSEADOR DE OPCIONALES CON PRECIO
// ==========================================
function parsearOpcionalesConPrecio(textoOpcionales) {
    if (!textoOpcionales) return [];
    
    return textoOpcionales.split(',').map(item => {
        const itemLimpio = item.trim();
        if (!itemLimpio) return null;

        let nombre = itemLimpio;
        let precioExtra = 0;

        if (itemLimpio.includes('+')) {
            const partes = itemLimpio.split('+');
            nombre = partes[0].trim();
            precioExtra = parseFloat(partes[1]) || 0;
        } else if (itemLimpio.includes(':')) {
            const partes = itemLimpio.split(':');
            nombre = partes[0].trim();
            precioExtra = parseFloat(partes[1]) || 0;
        }

        return { nombre, precioExtra };
    }).filter(Boolean);
}

// ==========================================
// 4. SUBIDA DE IMÁGENES A SUPABASE STORAGE
// ==========================================
async function subirImagenASupabase(archivo) {
    if (!archivo) {
        console.log("ℹ️ No se adjuntó ningún archivo de imagen.");
        return null;
    }

    try {
        console.log(`⏳ Subiendo archivo: ${archivo.name} (${archivo.size} bytes)...`);
        
        const timestamp = Date.now();
        const nombreSeguro = archivo.name.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const nombreRuta = `${timestamp}_${nombreSeguro}`;

        const { data: uploadData, error: uploadError } = await db.storage
            .from('imagenes')
            .upload(nombreRuta, archivo, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) {
            console.error("❌ Error de Supabase Storage:", uploadError);
            alert("❌ Falló la subida de la imagen: " + uploadError.message);
            return null;
        }

        console.log("✅ Imagen subida con éxito al bucket 'imagenes':", uploadData);

        const { data: publicUrlData } = db.storage
            .from('imagenes')
            .getPublicUrl(nombreRuta);

        if (!publicUrlData || !publicUrlData.publicUrl) {
            console.error("❌ No se pudo obtener la URL pública de la imagen.");
            return null;
        }

        console.log("🔗 URL pública obtenida:", publicUrlData.publicUrl);
        return publicUrlData.publicUrl;

    } catch (excepcion) {
        console.error("❌ Excepción durante la subida de imagen:", excepcion);
        alert("❌ Error inesperado al procesar la imagen seleccionada.");
        return null;
    }
}

// ==========================================
// 5. GESTIÓN DE GRUPOS DINÁMICOS DE SELECCIÓN (BOTÓN FUNCIONAL)
// ==========================================
let contadorGruposAdmin = 0;

window.agregarGrupoDinamicoAdmin = function(containerId = 'gruposDinamicosContainer', datos = { titulo: '', tipo: 'unico', opciones: '' }) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn(`⚠️ Contenedor de grupos dinámicos '${containerId}' no encontrado en el DOM.`);
        return;
    }

    const idUnico = `grupo_admin_${contadorGruposAdmin++}_${Date.now()}`;
    const opcionesTexto = Array.isArray(datos.opciones) ? datos.opciones.join(', ') : (datos.opciones || '');

    const bloqueHtml = `
        <div id="${idUnico}" class="grupo-dinamico-item bg-neutral-900 p-4 rounded-2xl border border-neutral-700 space-y-3 relative mb-3 shadow-xl">
            <button type="button" onclick="document.getElementById('${idUnico}').remove()" class="absolute top-3 right-3 text-neutral-400 hover:text-red-400 font-bold text-lg transition" title="Eliminar este grupo">&times;</button>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-semibold text-neutral-300 mb-1">Título de la Elección (Ej: Pan, Estado)</label>
                    <input type="text" class="grupo-titulo w-full px-3.5 py-2 bg-black rounded-xl text-xs border border-neutral-800 text-white focus:outline-none focus:border-white transition" placeholder="Ej: ¿Cómo querés el pan?" value="${datos.titulo || ''}">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-neutral-300 mb-1">Tipo de Casilla / Selección</label>
                    <select class="grupo-tipo w-full px-3.5 py-2 bg-black rounded-xl text-xs border border-neutral-800 text-white focus:outline-none focus:border-white transition">
                        <option value="unico" ${datos.tipo === 'unico' ? 'selected' : ''}>Única / Radio (Obligatorio elegir solo 1, ej: Tostado/Sin tostar)</option>
                        <option value="multiple" ${datos.tipo === 'multiple' ? 'selected' : ''}>Múltiple / Checkbox (Elegir varias opciones)</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="block text-xs font-semibold text-neutral-300 mb-1">Opciones disponibles (Separadas por comas)</label>
                <input type="text" class="grupo-opciones w-full px-3.5 py-2 bg-black rounded-xl text-xs border border-neutral-800 text-white focus:outline-none focus:border-white transition" placeholder="Ej: Tostado, Sin tostar, Pan árabe" value="${opcionesTexto}">
            </div>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', bloqueHtml);
    console.log(`➕ Tarjeta de grupo dinámico creada con éxito en '${containerId}'.`);
};

function recolectarGruposDinamicosAdmin(containerId = 'gruposDinamicosContainer') {
    const container = document.getElementById(containerId);
    if (!container) return [];

    const tarjetas = container.querySelectorAll('.grupo-dinamico-item');
    const resultado = [];

    tarjetas.forEach(tarjeta => {
        const inputTitulo = tarjeta.querySelector('.grupo-titulo');
        const selectTipo = tarjeta.querySelector('.grupo-tipo');
        const inputOpciones = tarjeta.querySelector('.grupo-opciones');

        if (inputTitulo && selectTipo && inputOpciones) {
            const titulo = inputTitulo.value.trim();
            const tipo = selectTipo.value;
            const opcionesRaw = inputOpciones.value.trim();

            if (titulo && opcionesRaw) {
                const opciones = opcionesRaw.split(',').map(o => o.trim()).filter(o => o.length > 0);
                resultado.push({ titulo, tipo, opciones });
            }
        }
    });

    return resultado;
}

// Vincular los botones de agregar grupo de forma segura en el DOM
document.addEventListener('DOMContentLoaded', () => {
    const addGrupoDinamicoBtn = document.getElementById('addGrupoDinamicoBtn');
    if (addGrupoDinamicoBtn) {
        addGrupoDinamicoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.agregarGrupoDinamicoAdmin('gruposDinamicosContainer');
        });
        console.log("✅ Botón '+ Agregar Grupo' vinculado correctamente.");
    }

    const editAddGrupoDinamicoBtn = document.getElementById('editAddGrupoDinamicoBtn');
    if (editAddGrupoDinamicoBtn) {
        editAddGrupoDinamicoBtn.addEventListener('click', (e) => {
            e.preventDefault();
            window.agregarGrupoDinamicoAdmin('editGruposDinamicosContainer');
        });
    }
});

// ==========================================
// 6. LISTAR Y RENDERIZAR PRODUCTOS CON STOCK
// ==========================================
async function cargarProductosAdmin() {
    try {
        console.log("🔄 Obteniendo inventario desde Supabase...");
        
        const { data: productos, error } = await db
            .from('productos')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error("❌ Error al consultar la tabla 'productos':", error);
            alert("❌ Error al cargar los productos de la base de datos.");
            return;
        }

        if (!productosTableBody) return;
        productosTableBody.innerHTML = '';

        if (!productos || productos.length === 0) {
            console.log("ℹ️ No se registraron productos en la base de datos.");
            productosTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center py-10 text-neutral-500 italic bg-neutral-950/30">
                        No hay productos registrados en el sistema. ¡Cargá el primero desde el formulario!
                    </td>
                </tr>`;
            return;
        }

        console.log(`📦 Procesando ${productos.length} productos para renderizado...`);

        productos.forEach((prod) => {
            let opcionesObj = { opcionales: [], dinamicos: [] };
            try {
                if (prod.opciones) {
                    opcionesObj = typeof prod.opciones === 'string' ? JSON.parse(prod.opciones) : prod.opciones;
                }
            } catch (e) {
                opcionesObj.opcionales = [prod.opciones];
            }

            const tr = document.createElement('tr');
            tr.className = "hover:bg-neutral-900/60 transition-colors border-b border-neutral-800";
            
            const fotoUrl = prod.foto && prod.foto.trim() !== '' 
                ? prod.foto 
                : 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=150&q=80';

            const precioFmt = Number(prod.precio).toLocaleString('es-AR', {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: 0
            });

            const stockActual = prod.stock !== undefined && prod.stock !== null ? prod.stock : 0;
            const badgeStock = stockActual > 0 
                ? `<span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-xl text-xs font-bold">${stockActual} un.</span>`
                : `<span class="bg-red-500/10 text-red-400 border border-red-500/30 px-3 py-1 rounded-xl text-xs font-bold">Agotado</span>`;

            let resumenDinamicos = '';
            if (opcionesObj.dinamicos && Array.isArray(opcionesObj.dinamicos) && opcionesObj.dinamicos.length > 0) {
                resumenDinamicos = opcionesObj.dinamicos.map(g => `
                    <span class="inline-block bg-neutral-900 border border-neutral-800 px-2 py-0.5 rounded text-[10px] text-neutral-300 mr-1 mb-1">
                        ${g.titulo} <b class="text-white">(${g.tipo === 'unico' ? 'Único' : 'Múltiple'})</b>
                    </span>
                `).join('');
            } else {
                resumenDinamicos = `<span class="text-[10px] text-neutral-500 italic">Sin grupos de selección dinámica</span>`;
            }

            const textOpc = opcionesObj.opcionales && opcionesObj.opcionales.length > 0 
                ? opcionesObj.opcionales.map(o => typeof o === 'object' ? `${o.nombre}${o.precioExtra > 0 ? ` (+$${o.precioExtra})` : ''}` : o).join(', ')
                : 'Ninguno';

            tr.innerHTML = `
                <td class="px-5 py-4 align-middle">
                    <img src="${fotoUrl}" alt="${prod.nombre}" class="w-14 h-14 object-cover rounded-2xl border border-neutral-800 shadow-md">
                </td>
                <td class="px-5 py-4 align-middle">
                    <div class="font-bold text-white text-base tracking-wide">${prod.nombre}</div>
                    <div class="text-xs text-neutral-400 truncate max-w-xs mt-0.5">${prod.descripcion || 'Sin descripción'}</div>
                    <div class="mt-2 space-y-1">
                        <div class="flex flex-wrap">${resumenDinamicos}</div>
                        <div class="text-[10px] text-neutral-300 font-medium bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800 block w-fit">
                            🟢 Opcionales con precio: ${textOpc}
                        </div>
                    </div>
                </td>
                <td class="px-5 py-4 align-middle font-bold text-white text-base whitespace-nowrap">
                    ${precioFmt}
                </td>
                <td class="px-5 py-4 align-middle text-center whitespace-nowrap">
                    ${badgeStock}
                </td>
                <td class="px-5 py-4 align-middle text-center space-x-2 whitespace-nowrap">
                    <button onclick="window.abrirModalEditar(${prod.id}, '${encodeURIComponent(prod.nombre)}', ${prod.precio}, ${stockActual}, '${encodeURIComponent(prod.foto || '')}', '${encodeURIComponent(prod.descripcion || '')}', '${encodeURIComponent(JSON.stringify(opcionesObj))}')" 
                            class="bg-white hover:bg-neutral-200 text-black px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md">
                        Editar
                    </button>
                    <button onclick="window.eliminarProducto(${prod.id})" 
                            class="bg-neutral-900 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 px-3.5 py-2 rounded-xl text-xs font-bold transition-all shadow-md">
                        Eliminar
                    </button>
                </td>
            `;
            productosTableBody.appendChild(tr);
        });

        console.log("✅ Inventario renderizado correctamente.");
    } catch (err) {
        console.error("❌ Excepción al renderizar inventario:", err);
    }
}

// ==========================================
// 7. REGISTRAR NUEVO PRODUCTO (CREATE)
// ==========================================
if (productForm) {
    productForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("📝 Formulario de alta enviado. Procesando datos...");

        const nombre = document.getElementById('prodNombre').value.trim();
        const precio = parseFloat(document.getElementById('prodPrecio').value);
        const stock = parseInt(document.getElementById('prodStock').value) || 0;
        const archivoInput = document.getElementById('prodFotoFile').files[0];
        const descripcion = document.getElementById('prodDesc').value.trim();

        const opcionalesTexto = document.getElementById('prodOpcionales') ? document.getElementById('prodOpcionales').value : '';
        const opcionalesEstructurados = parsearOpcionalesConPrecio(opcionalesTexto);
        const gruposDinamicos = recolectarGruposDinamicosAdmin('gruposDinamicosContainer');

        if (!nombre || isNaN(precio) || precio <= 0) {
            alert("⚠️ Ingresá un nombre válido y un precio mayor a 0.");
            return;
        }

        let fotoUrl = '';
        if (archivoInput) {
            alert("⏳ Subiendo imagen al servidor...");
            fotoUrl = await subirImagenASupabase(archivoInput) || '';
        }

        const opcionesJSON = JSON.stringify({
            opcionales: opcionalesEstructurados,
            dinamicos: gruposDinamicos
        });

        try {
            console.log("💾 Insertando en la tabla 'productos'...");
            const { error: insertError } = await db.from('productos').insert([{
                nombre,
                precio,
                stock,
                foto: fotoUrl,
                descripcion,
                opciones: opcionesJSON
            }]);

            if (insertError) {
                console.error("❌ Error de inserción en Supabase:", insertError);
                alert("❌ Falló el guardado del producto: " + insertError.message);
            } else {
                console.log("🎉 Producto creado con éxito.");
                alert("🎉 ¡Producto publicado en la carta!");
                productForm.reset();
                const containerDyn = document.getElementById('gruposDinamicosContainer');
                if (containerDyn) containerDyn.innerHTML = '';
                cargarProductosAdmin();
            }
        } catch (err) {
            console.error("❌ Excepción en alta de producto:", err);
            alert("❌ Error de comunicación con la base de datos.");
        }
    });
}

// ==========================================
// 8. ELIMINAR PRODUCTO (DELETE)
// ==========================================
window.eliminarProducto = async function(id) {
    if (!id) return;

    if (!confirm("¿Estás seguro de que querés eliminar este producto definitivamente?")) {
        return;
    }

    try {
        console.log(`🗑️ Eliminando registro ID: ${id}`);
        const { error: deleteError } = await db
            .from('productos')
            .delete()
            .eq('id', id);

        if (deleteError) {
            console.error("❌ Error al borrar en Supabase:", deleteError);
            alert("❌ No se pudo eliminar el producto: " + deleteError.message);
        } else {
            console.log("✅ Registro borrado exitosamente.");
            alert("🗑️ Producto eliminado correctamente.");
            cargarProductosAdmin();
        }
    } catch (err) {
        console.error("❌ Excepción durante la eliminación:", err);
    }
};

// ==========================================
// 9. CONTROL DEL MODAL DE EDICIÓN
// ==========================================
window.abrirModalEditar = function(id, nombre, precio, stock, foto, desc, opcionesStr) {
    console.log(`📂 Cargando datos en modal para el producto ID: ${id}`);

    document.getElementById('editId').value = id;
    document.getElementById('editNombre').value = decodeURIComponent(nombre);
    document.getElementById('editPrecio').value = precio;
    document.getElementById('editStock').value = stock;
    document.getElementById('editFotoActual').value = decodeURIComponent(foto);
    document.getElementById('editDesc').value = decodeURIComponent(desc);

    let opcionesObj = { opcionales: [], dinamicos: [] };
    try {
        opcionesObj = JSON.parse(decodeURIComponent(opcionesStr));
    } catch (e) {
        console.warn("⚠️ Formato de opciones plano detectado.");
    }

    const opcionalesTexto = opcionesObj.opcionales ? opcionesObj.opcionales.map(o => {
        if (typeof o === 'object' && o.nombre) {
            return o.precioExtra > 0 ? `${o.nombre} + ${o.precioExtra}` : o.nombre;
        }
        return o;
    }).join(', ') : '';

    if (document.getElementById('editOpcionales')) document.getElementById('editOpcionales').value = opcionalesTexto;

    // Rellenar grupos dinámicos en edición
    const containerEdit = document.getElementById('editGruposDinamicosContainer');
    if (containerEdit) {
        containerEdit.innerHTML = '';
        if (opcionesObj.dinamicos && Array.isArray(opcionesObj.dinamicos) && opcionesObj.dinamicos.length > 0) {
            opcionesObj.dinamicos.forEach(grupo => {
                window.agregarGrupoDinamicoAdmin('editGruposDinamicosContainer', grupo);
            });
        }
    }

    if (editModal) editModal.classList.remove('hidden');
};

const cerrarModalEditar = () => {
    if (editModal) {
        editModal.classList.add('hidden');
        if (editForm) editForm.reset();
        const containerEdit = document.getElementById('editGruposDinamicosContainer');
        if (containerEdit) containerEdit.innerHTML = '';
    }
};

if (closeModalBtn) closeModalBtn.addEventListener('click', cerrarModalEditar);
if (cancelEditBtn) cancelEditBtn.addEventListener('click', cerrarModalEditar);

// ==========================================
// 10. GUARDAR EDICIÓN (UPDATE PRODUCTO Y STOCK)
// ==========================================
if (editForm) {
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        console.log("📝 Guardando cambios de edición...");

        const id = document.getElementById('editId').value;
        const nombre = document.getElementById('editNombre').value.trim();
        const precio = parseFloat(document.getElementById('editPrecio').value);
        const stock = parseInt(document.getElementById('editStock').value) || 0;
        const archivoInput = document.getElementById('editFotoFile').files[0];
        const fotoActual = document.getElementById('editFotoActual').value;
        const descripcion = document.getElementById('editDesc').value.trim();

        const opcionalesTexto = document.getElementById('editOpcionales') ? document.getElementById('editOpcionales').value : '';
        const opcionalesEstructurados = parsearOpcionalesConPrecio(opcionalesTexto);
        const gruposDinamicos = recolectarGruposDinamicosAdmin('editGruposDinamicosContainer');

        if (!id || !nombre || isNaN(precio) || precio <= 0) {
            alert("⚠️ Por favor completá el nombre y un precio válido.");
            return;
        }

        let fotoUrlFinal = fotoActual;
        if (archivoInput) {
            alert("⏳ Subiendo nueva imagen...");
            const nuevaUrl = await subirImagenASupabase(archivoInput);
            if (nuevaUrl) fotoUrlFinal = nuevaUrl;
        }

        const opcionesJSON = JSON.stringify({
            opcionales: opcionalesEstructurados,
            dinamicos: gruposDinamicos
        });

        try {
            console.log(`💾 Actualizando registro ID: ${id} en Supabase...`);
            const { error: updateError } = await db
                .from('productos')
                .update({
                    nombre,
                    precio,
                    stock,
                    foto: fotoUrlFinal,
                    descripcion,
                    opciones: opcionesJSON
                })
                .eq('id', id);

            if (updateError) {
                console.error("❌ Error de actualización:", updateError);
                alert("❌ No se pudieron guardar los cambios: " + updateError.message);
            } else {
                console.log("🎉 Producto y stock actualizados exitosamente.");
                alert("🎉 ¡Producto y stock actualizados!");
                cerrarModalEditar();
                cargarProductosAdmin();
            }
        } catch (err) {
            console.error("❌ Excepción al actualizar:", err);
            alert("❌ Ocurrió un error inesperado.");
        }
    });
}

// Inicializar la carga del inventario al iniciar
cargarProductosAdmin();