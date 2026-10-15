import { db } from '../supabase.js';

console.log("==========================================");
console.log("MÓDULO CLIENTE CON CONTROL DE STOCK Y LIMPIEZA DE CARRITO");
console.log("==========================================");

// ==========================================
// 1. CONTROL DE SESIÓN Y AUTENTICACIÓN
// ==========================================
const validarSesionCliente = () => {
    try {
        const sesionString = localStorage.getItem("usuarioLogueado");
        
        if (!sesionString) {
            console.warn("⚠️ Intento de acceso sin sesión iniciada.");
            alert("⚠️ Debes iniciar sesión para explorar la carta.");
            window.location.replace("login.html");
            return false;
        }

        const usuario = JSON.parse(sesionString);
        console.log(`✅ Sesión iniciada correctamente como: ${usuario.email}`);
        return true;
    } catch (err) {
        console.error("❌ Excepción al validar sesión de cliente:", err);
        window.location.replace("login.html");
        return false;
    }
};

if (!validarSesionCliente()) {
    throw new Error("Ejecución detenida por falta de sesión activa.");
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm("¿Estás seguro de que querés cerrar la sesión?")) {
            console.log("🚪 Cerrando sesión del usuario...");
            localStorage.removeItem("usuarioLogueado");
            window.location.replace("login.html");
        }
    });
}

// ==========================================
// 2. ESTADO DEL CARRITO Y REFERENCIAS AL DOM
// ==========================================
let carrito = JSON.parse(localStorage.getItem("carritoMiralla")) || [];
let productoSeleccionado = null;

// Referencias de la Carta
const menuContainer = document.getElementById('menuContainer');
const contadorCarrito = document.getElementById('contadorCarrito');
const verCarritoBtn = document.getElementById('verCarritoBtn');
const cartModal = document.getElementById('cartModal');
const closeCartBtn = document.getElementById('closeCartBtn');
const cartItemsContainer = document.getElementById('cartItemsContainer');
const cartTotal = document.getElementById('cartTotal');
const finalizarPedidoBtn = document.getElementById('finalizarPedidoBtn');

// Referencias del Modal de Personalización
const productModal = document.getElementById('productModal');
const closeProductModal = document.getElementById('closeProductModal');
const modalImg = document.getElementById('modalImg');
const modalNombre = document.getElementById('modalNombre');
const modalPrecio = document.getElementById('modalPrecio');
const modalDesc = document.getElementById('modalDesc');
const modalStockBadge = document.getElementById('modalStockBadge');
const modalOpcionesContainer = document.getElementById('modalOpcionesContainer');
const modalAclaracion = document.getElementById('modalAclaracion');
const confirmarAgregarBtn = document.getElementById('confirmarAgregarBtn');

// Referencias del Modal de Pago
const paymentModal = document.getElementById('paymentModal');
const closePaymentBtn = document.getElementById('closePaymentBtn');
const paymentTotal = document.getElementById('paymentTotal');
const copyAliasBtn = document.getElementById('copyAliasBtn');
const aliasText = document.getElementById('aliasText');
const sendWhatsappBtn = document.getElementById('sendWhatsappBtn');

// ==========================================
// 3. PARSEADOR ROBUSTO DE OPCIONES JSON (SOPORTA DINÁMICOS Y ANTIGUOS)
// ==========================================
function parsearOpcionesProducto(opcionesRaw) {
    let resultado = { panes: [], guarnicion: [], opcionales: [], dinamicos: [] };

    if (!opcionesRaw) {
        console.log("ℹ️ El producto no posee datos en la columna de opciones.");
        return resultado;
    }

    try {
        let parsed = typeof opcionesRaw === 'string' ? JSON.parse(opcionesRaw) : opcionesRaw;
        
        if (typeof parsed === 'string') { 
            try { 
                parsed = JSON.parse(parsed); 
            } catch(e) {
                console.warn("⚠️ No se pudo deserializar el segundo nivel JSON:", e);
            } 
        }

        if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
            resultado.panes = Array.isArray(parsed.panes) ? parsed.panes : [];
            resultado.guarnicion = Array.isArray(parsed.guarnicion) ? parsed.guarnicion : [];
            resultado.opcionales = Array.isArray(parsed.opcionales) ? parsed.opcionales : [];
            resultado.dinamicos = Array.isArray(parsed.dinamicos) ? parsed.dinamicos : [];
        } else if (typeof parsed === 'string') {
            const lista = parsed.split(',').map(s => s.trim()).filter(Boolean);
            resultado.opcionales = lista.map(item => ({ nombre: item, precioExtra: 0 }));
        }
    } catch (err) {
        console.warn("⚠️ Error al analizar las opciones en JSON, aplicando formato fallback:", err);
        if (typeof opcionesRaw === 'string') {
            const lista = opcionesRaw.split(',').map(s => s.trim()).filter(Boolean);
            resultado.opcionales = lista.map(item => ({ nombre: item, precioExtra: 0 }));
        }
    }

    return resultado;
}

// ==========================================
// 4. CARGAR Y RENDERIZAR MENÚ CON STOCK VISIBLE E INHABILITACIÓN
// ==========================================
async function cargarMenuCliente() {
    try {
        console.log("🔄 Consultando catálogo de productos desde Supabase...");
        
        const { data: productos, error } = await db
            .from('productos')
            .select('*')
            .order('id', { ascending: false });

        if (error) {
            console.error("❌ Error al obtener los productos:", error);
            alert("❌ Ocurrió un error al cargar la carta. Reintentá en unos momentos.");
            return;
        }

        if (!menuContainer) {
            console.error("❌ El contenedor 'menuContainer' no fue encontrado en el DOM.");
            return;
        }

        menuContainer.innerHTML = '';

        if (!productos || productos.length === 0) {
            console.log("ℹ️ No se encontraron productos cargados en la base de datos.");
            menuContainer.innerHTML = `
                <p class="col-span-full text-center text-neutral-500 py-12 text-sm font-medium">
                    No hay productos disponibles por el momento. ¡Volvé a consultar más tarde!
                </p>`;
            return;
        }

        console.log(`📦 Se cargaron ${productos.length} productos correctamente.`);

        productos.forEach(prod => {
            const card = document.createElement('div');
            card.className = "bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-xl flex flex-col hover:border-neutral-700 transition-all duration-300 group relative";
            
            const fotoUrl = prod.foto && prod.foto.trim() !== '' 
                ? prod.foto 
                : 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=400&q=80';
            
            const precioFmt = Number(prod.precio).toLocaleString('es-AR', { 
                style: 'currency', 
                currency: 'ARS', 
                minimumFractionDigits: 0 
            });

            const stockDisponible = prod.stock !== undefined && prod.stock !== null ? prod.stock : 0;
            const opcionesJSONEscapado = encodeURIComponent(JSON.stringify(prod.opciones || {}));

            let badgeStockHTML = '';
            if (stockDisponible <= 0) {
                badgeStockHTML = `<span class="bg-red-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-wider">Sin Stock</span>`;
            } else if (stockDisponible <= 3) {
                badgeStockHTML = `<span class="bg-amber-600 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md">⚠️ ¡Últimas ${stockDisponible} un!</span>`;
            } else {
                badgeStockHTML = `<span class="bg-emerald-600/90 text-white text-[10px] font-bold px-2.5 py-1 rounded-lg backdrop-blur-sm">Stock: ${stockDisponible} un.</span>`;
            }

            const botonAccion = stockDisponible > 0 
                ? `<button onclick="window.abrirModalProducto(${prod.id}, '${encodeURIComponent(prod.nombre)}', ${prod.precio}, ${stockDisponible}, '${encodeURIComponent(fotoUrl)}', '${encodeURIComponent(prod.descripcion || '')}', '${opcionesJSONEscapado}')" 
                           class="bg-white hover:bg-neutral-200 active:scale-95 text-black px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer">
                       + Seleccionar
                   </button>`
                : `<button disabled 
                           class="bg-neutral-900 text-neutral-600 px-4 py-2 rounded-xl text-xs font-bold border border-neutral-800 cursor-not-allowed opacity-60">
                       Agotado
                   </button>`;

            card.innerHTML = `
                <div class="relative overflow-hidden">
                    <img src="${fotoUrl}" alt="${prod.nombre}" class="w-full h-44 object-cover group-hover:scale-105 transition-transform duration-300 ${stockDisponible <= 0 ? 'opacity-30 grayscale' : ''}">
                    <div class="absolute top-2 right-2">
                        ${badgeStockHTML}
                    </div>
                </div>
                <div class="p-5 flex flex-col flex-grow ${stockDisponible <= 0 ? 'opacity-50' : ''}">
                    <h3 class="font-bold text-white text-base tracking-wide">${prod.nombre}</h3>
                    <p class="text-xs text-neutral-400 mt-1 flex-grow line-clamp-2 leading-relaxed">${prod.descripcion || 'Sin descripción disponible.'}</p>
                    <div class="flex justify-between items-center mt-4 pt-3 border-t border-neutral-800">
                        <span class="font-black text-white text-base">${precioFmt}</span>
                        ${botonAccion}
                    </div>
                </div>
            `;
            menuContainer.appendChild(card);
        });

        console.log("✅ Catálogo de productos renderizado en el cliente.");
    } catch (err) {
        console.error("❌ Excepción imprevista al cargar el menú:", err);
    }
}

// ==========================================
// 5. ABRIR MODAL Y GENERAR OPCIONES
// ==========================================
window.abrirModalProducto = (id, nombre, precio, stock, foto, desc, opcionesStr) => {
    console.log(`📂 Abriendo modal para producto ID: ${id} (Stock actual: ${stock})`);

    let rawOpciones = null;
    try { 
        rawOpciones = JSON.parse(decodeURIComponent(opcionesStr)); 
    } catch(e) { 
        rawOpciones = decodeURIComponent(opcionesStr); 
    }

    const opcionesEstructuradas = parsearOpcionesProducto(rawOpciones);

    productoSeleccionado = {
        id,
        nombre: decodeURIComponent(nombre),
        precioBase: parseFloat(precio),
        stockMaximo: parseInt(stock),
        foto: decodeURIComponent(foto),
        opcionesEstructura: opcionesEstructuradas
    };

    modalNombre.textContent = productoSeleccionado.nombre;
    modalPrecio.textContent = Number(precio).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
    modalDesc.textContent = decodeURIComponent(desc);
    modalImg.src = productoSeleccionado.foto;
    modalAclaracion.value = '';

    if (modalStockBadge) {
        modalStockBadge.textContent = `Stock: ${productoSeleccionado.stockMaximo} un.`;
        modalStockBadge.className = productoSeleccionado.stockMaximo <= 3 
            ? "text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30"
            : "text-[10px] font-extrabold px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30";
    }

    modalOpcionesContainer.innerHTML = '';
    let hayOpciones = false;

    if (opcionesEstructuradas.dinamicos && Array.isArray(opcionesEstructuradas.dinamicos) && opcionesEstructuradas.dinamicos.length > 0) {
        hayOpciones = true;
        opcionesEstructuradas.dinamicos.forEach((grupo, idxGrupo) => {
            const block = document.createElement('div');
            block.className = "mb-3 bg-neutral-900 p-3.5 rounded-2xl border border-neutral-800 space-y-2";
            
            const esUnico = grupo.tipo === 'unico';
            
            block.innerHTML = `
                <div class="flex justify-between items-center border-b border-neutral-800 pb-1.5 mb-2">
                    <span class="text-xs font-bold text-white flex items-center gap-2">
                        📌 ${grupo.titulo}
                    </span>
                    <span class="text-[9px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded ${esUnico ? 'bg-amber-950/60 text-amber-300 border border-amber-800/60' : 'bg-neutral-800 text-neutral-300'}">
                        ${esUnico ? 'Única (Elegir 1)' : 'Múltiple'}
                    </span>
                </div>
            `;

            let opcionesHtml = '<div class="space-y-1.5">';
            grupo.opciones.forEach((opcion, idxOp) => {
                const inputId = `dinamico_${idxGrupo}_${idxOp}`;
                const inputName = `grupo_dinamico_${idxGrupo}`;

                if (esUnico) {
                    opcionesHtml += `
                        <label for="${inputId}" class="flex items-center space-x-3 p-2.5 rounded-xl bg-black border border-neutral-800 cursor-pointer hover:border-neutral-600 transition shadow-sm">
                            <input type="radio" id="${inputId}" name="${inputName}" value="${opcion}" ${idxOp === 0 ? 'checked' : ''} class="accent-white text-black cursor-pointer">
                            <span class="text-xs text-neutral-200 font-medium">${opcion}</span>
                        </label>
                    `;
                } else {
                    opcionesHtml += `
                        <label for="${inputId}" class="flex items-center space-x-3 p-2.5 rounded-xl bg-black border border-neutral-800 cursor-pointer hover:border-neutral-600 transition shadow-sm">
                            <input type="checkbox" id="${inputId}" name="${inputName}" value="${opcion}" class="accent-white text-black rounded cursor-pointer">
                            <span class="text-xs text-neutral-200 font-medium">${opcion}</span>
                        </label>
                    `;
                }
            });
            opcionesHtml += '</div>';
            block.innerHTML += opcionesHtml;
            modalOpcionesContainer.appendChild(block);
        });
    }

    if (opcionesEstructuradas.panes && opcionesEstructuradas.panes.length > 0) {
        hayOpciones = true;
        const block = document.createElement('div');
        block.className = "mb-3 bg-neutral-900 p-3 rounded-2xl border border-neutral-800 space-y-1.5";
        block.innerHTML = `<span class="block text-xs font-bold text-white mb-2">📌 Opciones de Pan (Elegí 1):</span>`;
        
        opcionesEstructuradas.panes.forEach((item, index) => {
            block.innerHTML += `
                <label class="flex items-center space-x-2 text-xs text-neutral-200 my-1 cursor-pointer bg-black p-2 rounded-xl border border-neutral-800 hover:bg-neutral-800 transition">
                    <input type="radio" name="grupoPanesRadio" value="${item}" ${index === 0 ? 'checked' : ''} class="cursor-pointer">
                    <span>${item}</span>
                </label>
            `;
        });
        modalOpcionesContainer.appendChild(block);
    }

    if (opcionesEstructuradas.guarnicion && opcionesEstructuradas.guarnicion.length > 0) {
        hayOpciones = true;
        const block = document.createElement('div');
        block.className = "mb-3 bg-neutral-900 p-3 rounded-2xl border border-neutral-800 space-y-1.5";
        block.innerHTML = `<span class="block text-xs font-bold text-neutral-300 mb-2">🍟 Guarniciones (Seleccioná las que quieras):</span>`;
        
        opcionesEstructuradas.guarnicion.forEach(item => {
            block.innerHTML += `
                <label class="flex items-center space-x-2 text-xs text-neutral-200 my-1 cursor-pointer bg-black p-2 rounded-xl border border-neutral-800 hover:bg-neutral-800 transition">
                    <input type="checkbox" name="grupoGuarnicion" value="${item}" class="rounded cursor-pointer">
                    <span>${item}</span>
                </label>
            `;
        });
        modalOpcionesContainer.appendChild(block);
    }

    if (opcionesEstructuradas.opcionales && opcionesEstructuradas.opcionales.length > 0) {
        hayOpciones = true;
        const block = document.createElement('div');
        block.className = "mb-3 bg-neutral-900 p-3 rounded-2xl border border-neutral-800 space-y-1.5";
        block.innerHTML = `<span class="block text-xs font-bold text-neutral-200 mb-2">➕ Agregados Extra (Con costo adicional):</span>`;
        
        opcionesEstructuradas.opcionales.forEach(opc => {
            const nombreOpc = typeof opc === 'object' ? opc.nombre : opc;
            const precioExtra = typeof opc === 'object' ? (parseFloat(opc.precioExtra) || 0) : 0;

            block.innerHTML += `
                <label class="flex items-center justify-between text-xs text-neutral-200 my-1 cursor-pointer bg-black p-2 rounded-xl border border-neutral-800 hover:bg-neutral-800 transition">
                    <div class="flex items-center space-x-2">
                        <input type="checkbox" name="grupoOpcional" value="${nombreOpc}" data-precio="${precioExtra}" class="rounded cursor-pointer">
                        <span>${nombreOpc}</span>
                    </div>
                    ${precioExtra > 0 ? `<span class="text-white font-semibold text-[11px]">+ $${precioExtra.toLocaleString('es-AR')}</span>` : ''}
                </label>
            `;
        });
        modalOpcionesContainer.appendChild(block);
    }

    if (!hayOpciones) {
        modalOpcionesContainer.innerHTML = `<p class="text-xs text-neutral-500 italic py-2">Este producto no cuenta con opciones personalizables.</p>`;
    }

    if (productModal) productModal.classList.remove('hidden');
};

if (closeProductModal) {
    closeProductModal.addEventListener('click', () => {
        if (productModal) productModal.classList.add('hidden');
    });
}

// ==========================================
// 6. AGREGAR PRODUCTO AL CARRITO
// ==========================================
if (confirmarAgregarBtn) {
    confirmarAgregarBtn.addEventListener('click', () => {
        console.log("➕ Procesando adición al carrito con validación de stock...");

        let precioAdicionalTotal = 0;
        let listaFinalOpciones = [];

        if (productoSeleccionado.opcionesEstructura.dinamicos && Array.isArray(productoSeleccionado.opcionesEstructura.dinamicos)) {
            productoSeleccionado.opcionesEstructura.dinamicos.forEach((grupo, idxGrupo) => {
                const inputName = `grupo_dinamico_${idxGrupo}`;
                const marcados = modalOpcionesContainer.querySelectorAll(`input[name="${inputName}"]:checked`);
                
                marcados.forEach(input => {
                    listaFinalOpciones.push(`${grupo.titulo}: ${input.value}`);
                });
            });
        }

        const panSeleccionado = modalOpcionesContainer.querySelector('input[name="grupoPanesRadio"]:checked');
        if (panSeleccionado) {
            listaFinalOpciones.push(`Opción: ${panSeleccionado.value}`);
        }

        const guarnicionesElegidas = Array.from(modalOpcionesContainer.querySelectorAll('input[name="grupoGuarnicion"]:checked')).map(cb => cb.value);
        if (guarnicionesElegidas.length > 0) {
            listaFinalOpciones.push(`Guarniciones: ${guarnicionesElegidas.join(', ')}`);
        }

        const opcionalesElegidos = Array.from(modalOpcionesContainer.querySelectorAll('input[name="grupoOpcional"]:checked'));
        opcionalesElegidos.forEach(cb => {
            const pExtra = parseFloat(cb.getAttribute('data-precio')) || 0;
            precioAdicionalTotal += pExtra;
            const textoDetalle = pExtra > 0 ? `${cb.value} (+$${pExtra})` : cb.value;
            listaFinalOpciones.push(textoDetalle);
        });

        const aclaracion = modalAclaracion.value.trim();
        const precioUnitarioFinal = productoSeleccionado.precioBase + precioAdicionalTotal;

        const unidadesEnCarrito = carrito
            .filter(item => item.id === productoSeleccionado.id)
            .reduce((sum, item) => sum + item.cantidad, 0);

        if (unidadesEnCarrito + 1 > productoSeleccionado.stockMaximo) {
            alert(`⚠️ No podés sumar más unidades. Stock disponible alcanzado (${productoSeleccionado.stockMaximo} un.).`);
            return;
        }

        const itemKey = `${productoSeleccionado.id}-${listaFinalOpciones.sort().join('-')}-${aclaracion}`;
        const existente = carrito.find(item => item.key === itemKey);

        if (existente) {
            existente.cantidad += 1;
        } else {
            carrito.push({
                key: itemKey,
                id: productoSeleccionado.id,
                nombre: productoSeleccionado.nombre,
                precioUnitario: precioUnitarioFinal,
                foto: productoSeleccionado.foto,
                opciones: listaFinalOpciones,
                aclaracion: aclaracion,
                cantidad: 1,
                stockMax: productoSeleccionado.stockMaximo
            });
        }

        actualizarCarrito();
        
        if (productModal) productModal.classList.add('hidden');
        alert("🛒 ¡Producto agregado al carrito!");
    });
}

// ==========================================
// 7. GESTIÓN DEL CARRITO Y CONTROL DE CANTIDADES
// ==========================================
function actualizarCarrito() {
    try {
        localStorage.setItem("carritoMiralla", JSON.stringify(carrito));
        
        const totalUnidades = carrito.reduce((acc, item) => acc + item.cantidad, 0);
        if (contadorCarrito) contadorCarrito.textContent = totalUnidades;

        if (!cartItemsContainer) return;
        cartItemsContainer.innerHTML = '';

        if (carrito.length === 0) {
            cartItemsContainer.innerHTML = `
                <div class="text-center py-12 text-neutral-500">
                    <p class="text-3xl mb-2">🛒</p>
                    <p class="text-sm font-medium">Tu carrito está vacío.</p>
                    <p class="text-xs text-neutral-600 mt-1">Elegí tus opciones favoritas para empezar.</p>
                </div>`;
            if (cartTotal) cartTotal.textContent = "$0";
            return;
        }

        let totalGeneral = 0;

        carrito.forEach((item, index) => {
            const subtotal = item.precioUnitario * item.cantidad;
            totalGeneral += subtotal;

            const div = document.createElement('div');
            div.className = "bg-neutral-900 p-4 rounded-2xl border border-neutral-800 space-y-2.5 shadow-md";
            
            const textoOpciones = item.opciones.length > 0 ? `<div class="text-[11px] text-neutral-300 font-medium">${item.opciones.join(' • ')}</div>` : '';
            const textoNota = item.aclaracion ? `<div class="text-[11px] text-neutral-400 italic">Nota: "${item.aclaracion}"</div>` : '';

            div.innerHTML = `
                <div class="flex justify-between items-start">
                    <div class="flex space-x-3">
                        <img src="${item.foto}" alt="${item.nombre}" class="w-12 h-12 object-cover rounded-xl border border-neutral-800">
                        <div>
                            <h4 class="font-bold text-white text-sm">${item.nombre}</h4>
                            <div class="text-xs text-neutral-300 font-semibold">$${Number(item.precioUnitario).toLocaleString('es-AR')} c/u</div>
                            ${textoOpciones}
                            ${textoNota}
                        </div>
                    </div>
                </div>
                <div class="flex justify-between items-center pt-2 border-t border-neutral-800 mt-1">
                    <div class="flex items-center space-x-2">
                        <button onclick="window.cambiarCantidad(${index}, -1)" class="bg-black hover:bg-neutral-800 text-white border border-neutral-800 w-7 h-7 rounded-lg font-bold flex items-center justify-center">-</button>
                        <span class="font-bold text-sm w-6 text-center text-white">${item.cantidad}</span>
                        <button onclick="window.cambiarCantidad(${index}, 1)" class="bg-black hover:bg-neutral-800 text-white border border-neutral-800 w-7 h-7 rounded-lg font-bold flex items-center justify-center">+</button>
                    </div>
                    <span class="font-black text-white text-sm">$${Number(subtotal).toLocaleString('es-AR')}</span>
                </div>
            `;
            cartItemsContainer.appendChild(div);
        });

        if (cartTotal) {
            cartTotal.textContent = Number(totalGeneral).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
        }

        console.log(`🛒 Carrito actualizado. Total a pagar: $${totalGeneral}`);
    } catch (err) {
        console.error("❌ Error al actualizar la vista del carrito:", err);
    }
}

window.cambiarCantidad = (index, delta) => {
    if (carrito[index]) {
        if (delta > 0) {
            const unidadesEnCarrito = carrito
                .filter((item, i) => i !== index && item.id === carrito[index].id)
                .reduce((sum, item) => sum + item.cantidad, 0);

            if (unidadesEnCarrito + carrito[index].cantidad + 1 > carrito[index].stockMax) {
                alert(`⚠️ Límite de stock alcanzado. No hay más unidades disponibles.`);
                return;
            }
        }
        carrito[index].cantidad += delta;
        if (carrito[index].cantidad <= 0) {
            carrito.splice(index, 1);
        }
        actualizarCarrito();
    }
};

if (verCarritoBtn) verCarritoBtn.addEventListener('click', () => { if (cartModal) cartModal.classList.remove('hidden'); });
if (closeCartBtn) closeCartBtn.addEventListener('click', () => { if (cartModal) cartModal.classList.add('hidden'); });

// ==========================================
// 8. FINALIZACIÓN, MODAL DE PAGO, DESCUENTO DE STOCK Y VACIADO
// ==========================================
if (finalizarPedidoBtn) {
    finalizarPedidoBtn.addEventListener('click', () => {
        if (carrito.length === 0) {
            alert("⚠️ El carrito se encuentra vacío.");
            return;
        }

        const total = carrito.reduce((acc, item) => acc + (item.precioUnitario * item.cantidad), 0);
        
        if (paymentTotal) {
            paymentTotal.textContent = Number(total).toLocaleString('es-AR', {
                style: 'currency',
                currency: 'ARS',
                minimumFractionDigits: 0
            });
        }

        if (cartModal) cartModal.classList.add('hidden');
        if (paymentModal) paymentModal.classList.remove('hidden');
    });
}

if (copyAliasBtn && aliasText) {
    copyAliasBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(aliasText.textContent.trim()).then(() => {
            copyAliasBtn.textContent = "¡Copiado!";
            setTimeout(() => { copyAliasBtn.textContent = "Copiar"; }, 2000);
        });
    });
}

if (closePaymentBtn) {
    closePaymentBtn.addEventListener('click', () => {
        if (paymentModal) paymentModal.classList.add('hidden');
    });
}

if (sendWhatsappBtn) {
    sendWhatsappBtn.addEventListener('click', async () => {
        console.log("📉 Descontando unidades compradas del stock en Supabase...");

        for (const item of carrito) {
            try {
                const { data: prodData } = await db.from('productos').select('stock').eq('id', item.id).single();
                if (prodData) {
                    const stockActualizado = Math.max(0, (prodData.stock || 0) - item.cantidad);
                    await db.from('productos').update({ stock: stockActualizado }).eq('id', item.id);
                }
            } catch (err) {
                console.error("❌ Error al descontar stock del producto:", item.id, err);
            }
        }

        let mensaje = "🥪 *NUEVO PEDIDO - BUFFET FRAGA LIBERTAD* 🥪\n\n";
        let total = 0;

        carrito.forEach((item, idx) => {
            const sub = item.precioUnitario * item.cantidad;
            total += sub;
            mensaje += `${idx + 1}. *${item.nombre}* x${item.cantidad} ($${sub.toLocaleString('es-AR')})\n`;
            if (item.opciones.length > 0) {
                mensaje += `   - ${item.opciones.join('\n   - ')}\n`;
            }
            if (item.aclaracion) {
                mensaje += `   - Nota: ${item.aclaracion}\n`;
            }
            mensaje += `\n`;
        });

        mensaje += `*TOTAL A PAGAR: $${total.toLocaleString('es-AR')}*\n\n`;
        mensaje += `📎 *Adjunto el comprobante de transferencia a continuación.*`;

        console.log("🧹 Vaciando carrito de compras post-pedido...");
        carrito = [];
        localStorage.removeItem("carritoMiralla");
        actualizarCarrito();

        const numeroTelefono = "5491126272612";
        const urlWhatsApp = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(mensaje)}`;
        window.open(urlWhatsApp, '_blank');

        cargarMenuCliente();
        if (paymentModal) paymentModal.classList.add('hidden');
    });
}

cargarMenuCliente();
actualizarCarrito();