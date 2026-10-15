import { db } from '../supabase.js';

console.log("Módulo de autenticación avanzado vinculado correctamente.");

const registerForm = document.getElementById('registerForm');
const loginForm = document.getElementById('loginForm');
const logoutBtn = document.getElementById('logoutBtn');

// ==========================================
// 1. LÓGICA DE REGISTRO
// ==========================================
if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value.trim();
        const rol = document.getElementById('regRol').value;

        if (!email || !password) {
            alert('⚠️ Por favor, completá todos los campos.');
            return;
        }

        try {
            // Verificar si el correo ya existe
            const { data: existente, error: errBusqueda } = await db
                .from('usuarios')
                .select('*')
                .eq('email', email);
            
            if (errBusqueda) {
                console.error("Error al verificar existencia:", errBusqueda);
            }

            if (existente && existente.length > 0) {
                alert('⚠️ Este correo ya se encuentra registrado en el sistema.');
                return;
            }

            // Insertar nuevo usuario en la base de datos
            const { error: errInsercion } = await db
                .from('usuarios')
                .insert([{ email, password, rol }]);
            
            if (errInsercion) {
                console.error("Error al registrar:", errInsercion);
                alert('❌ Error al registrar: ' + errInsercion.message);
            } else {
                alert(`🎉 ¡Cuenta de ${rol.toUpperCase()} creada con éxito! Ya podés iniciar sesión.`);
                window.location.replace('login.html');
            }
        } catch (err) {
            console.error("Excepción grave en registro:", err);
            alert('❌ Ocurrió un error inesperado al conectar con Supabase.');
        }
    });
}

// ==========================================
// 2. LÓGICA DE INICIO DE SESIÓN
// ==========================================
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value.trim();

        if (!email || !password) {
            alert('⚠️ Por favor, ingresá tu correo y contraseña.');
            return;
        }

        try {
            // Consultar credenciales en Supabase
            const { data: usuarios, error } = await db
                .from('usuarios')
                .select('*')
                .eq('email', email)
                .eq('password', password);

            if (error || !usuarios || usuarios.length === 0) {
                alert('❌ Correo o contraseña incorrectos.');
                return;
            }

            const usuario = usuarios[0];
            
            // Guardar sesión activa en el navegador
            localStorage.setItem("usuarioLogueado", JSON.stringify({ 
                email: usuario.email, 
                rol: usuario.rol 
            }));

            alert(`¡Bienvenido de nuevo, ${usuario.email}! Rol: ${usuario.rol}`);

            // Redirección inteligente según el rol obtenido de la base de datos
            if (usuario.rol === 'admin') {
                window.location.replace("admin.html");
            } else {
                window.location.replace("index.html");
            }
        } catch (err) {
            console.error("Excepción grave en login:", err);
            alert('❌ Error al intentar iniciar sesión.');
        }
    });
}

// ==========================================
// 3. PROTECCIÓN DE RUTAS Y CONTROL DE SESIÓN
// ==========================================
const paginaActual = window.location.pathname;
const usuarioSesion = JSON.parse(localStorage.getItem("usuarioLogueado"));

// Si intenta entrar al panel de administración sin ser admin
if (paginaActual.includes("admin.html")) {
    if (!usuarioSesion || usuarioSesion.rol !== 'admin') {
        alert("⛔ Acceso denegado. No tenés permisos de administrador.");
        window.location.replace("login.html");
    }
}

// Si intenta entrar al menú principal sin haber iniciado sesión
if (paginaActual.includes("index.html")) {
    if (!usuarioSesion) {
        alert("⚠️ Debes iniciar sesión para ver la carta.");
        window.location.replace("login.html");
    }
}

// ==========================================
// 4. LÓGICA DE CIERRE DE SESIÓN (LOGOUT)
// ==========================================
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        localStorage.removeItem("usuarioLogueado");
        alert("Sesión cerrada correctamente.");
        window.location.replace("login.html");
    });
}