import 'bootstrap/dist/css/bootstrap.min.css';  
import 'bootstrap/dist/js/bootstrap.bundle.min.js'; 

// Esperamos a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {  
    console.log('DOM cargado — inicializando script de notaciones');

    // Expresión regular para validar que solo haya números, operadores y paréntesis
    const validacion = /^[\d.+\-*/() \t]+$/;  

    // Selector rápido tipo jQuery
    const $ = s => document.querySelector(s);  
    const btn = $("#btn_calcular");  // botón de cálculo
    const recorridos = $("#recorridos");  // contenedor de resultados

    // Validamos que existan los elementos
    if (!btn) { console.error('No se encontró #btn_calcular'); return; }  
    if (!recorridos) { console.error('No se encontró #recorridos'); return; }

    // Función que devuelve la precedencia de los operadores
    const prec = o => o === '+' || o === '-' ? 1 : o === '*' || o === '/' ? 2 : 0;  // ES6: arrow function

    // Función que determina si un token es un número
    const isNum = t => /^\d+(\.\d+)?$/.test(t);  

    // Función que determina si un token es un operador
    const isOp = t => /[+\-*/]/.test(t); 

    // Función que convierte la expresión en tokens
    function tok(expr){
        // Eliminamos espacios y extraemos números, operadores y paréntesis
        const t = (expr.replace(/\s+/g,'').match(/(\d+(\.\d+)?|\+|\-|\*|\/|\(|\))/g)||[]);
        const out = [];  // array final de tokens

        // Recorremos cada token
        for(let i = 0; i < t.length; i++){
            const c = t[i];  // token actual
            const p = out[out.length - 1];  // token anterior
            // Detectamos signos unarios (+/- al inicio o después de '(' o un operador)
            const un = (c === '+' || c === '-') && (i === 0 || p === '(' || isOp(p));

            if(un && c === '+') continue;  // ignoramos '+' unario
            if(un && c === '-') out.push('0','-');  // convertimos '-' unario a '0 -'
            else out.push(c);  // añadimos el token normal
        }
        return out;  // devolvemos array de tokens
    }

    // Función para validar que los paréntesis estén balanceados
    function parenOK(tk){ 
        let d = 0;  // contador de paréntesis abiertos
        for(const t of tk){  // recorremos tokens
            if(t === '(') d++;  // abrimos paréntesis
            else if(t === ')' && --d < 0) return false;  // cerramos y verificamos
        } 
        return d === 0;  // true si todos balanceados
    }

    // Función que valida la secuencia de tokens
    function seqOK(tk){
        if(!tk.length || isOp(tk[0]) || isOp(tk.at(-1))) return false;  // operador al inicio o fin no permitido
        for(let i = 0; i < tk.length - 1; i++){
            const a = tk[i], b = tk[i + 1];  // tokens consecutivos
            // dos números seguidos o número seguido de '(' -> inválido
            if((isNum(a) && (isNum(b) || b === '(')) || (a === ')' && (isNum(b) || b === '('))) return false;
            // dos operadores seguidos o '(' seguido de operador o ')' seguido de operador -> inválido
            if((isOp(a) && (isOp(b) || b === ')')) || (a === '(' && (isOp(b) || b === ')'))) return false;
        }
        return true;  // todo correcto
    }

    // Función que convierte tokens a Notación Postfija (RPN)
    function toRPN(tk){
        const out = [];  // salida
        const ops = [];  // pila de operadores
        for(const t of tk){
            if(isNum(t)) out.push(t);  // número -> salida
            else if(isOp(t)){  // operador
                while(ops.length && isOp(ops.at(-1)) && prec(ops.at(-1)) >= prec(t)) 
                    out.push(ops.pop());  // sacamos operadores de mayor o igual precedencia
                ops.push(t);  // añadimos operador a pila
            } else if(t === '(') ops.push(t);  // '(' -> pila
            else {  // ')'
                while(ops.length && ops.at(-1) !== '(') out.push(ops.pop());  // sacamos hasta '('
                if(!ops.length) throw Error('Paréntesis desbalanceados');  // error si no hay '('
                ops.pop();  // sacamos '(' de la pila
            }
        }
        while(ops.length){  // vaciamos pila restante
            const top = ops.pop();
            if(top === '(' || top === ')') throw Error('Paréntesis desbalanceados');
            out.push(top);
        }
        return out;  // RPN final
    }

    // Función que convierte RPN a AST (árbol de sintaxis)
    function rpn2ast(r){
        const s = [];  // pila de nodos
        for(const t of r){
            if(isNum(t)) s.push({t:'n', v:t, l:null, r:null});  // nodo número
            else{
                const b = s.pop(), a = s.pop();  // operandos
                if(!a || !b) throw Error('Expresión inválida');  // error si faltan operandos
                s.push({t:'o', v:t, l:a, r:b});  // nodo operador
            }
        }
        if(s.length !== 1) throw Error('Expresión inválida');  // debe quedar un solo nodo
        return s[0];  // raíz del AST
    }

    // funciones de recorrido del AST
    function inorden(n,res=[]){ 
        if(!n) return res;  // nodo nulo
        if(n.t === 'o'){ inorden(n.l,res); res.push(n.v); inorden(n.r,res); }  // operador: izquierda, raíz, derecha
        else res.push(n.v);  // número
        return res;
    }

    function preorden(n,res=[]){
        if(!n) return res;
        res.push(n.v);  // raíz
        if(n.t === 'o'){ preorden(n.l,res); preorden(n.r,res); }  // izquierda, derecha
        return res;
    }

    function postorden(n,res=[]){
        if(!n) return res;
        if(n.t === 'o'){ postorden(n.l,res); postorden(n.r,res); }  // izquierda, derecha
        res.push(n.v);  // raíz al final
        return res;
    }

    // Evaluar RPN usando pila
    function evalRPN(rpn){
        const stack = [];
        for(const t of rpn){
            if(isNum(t)) stack.push(t.includes('.') ? Number(t) : BigInt(t));  // número decimal o entero grande
            else{
                const b = stack.pop(), a = stack.pop();  // operandos
                if(a === undefined || b === undefined) throw Error('Operandos faltantes');
                let res;
                if(t === '+') res = (typeof a==='bigint') ? a+b : Number(a)+Number(b);
                else if(t === '-') res = (typeof a==='bigint') ? a-b : Number(a)-Number(b);
                else if(t === '*') res = (typeof a==='bigint') ? a*b : Number(a)*Number(b);
                else if(t === '/') res = Number(a)/Number(b);
                stack.push(res);  // resultado a la pila
            }
        }
        if(stack.length !== 1) throw Error('Resultado inválido');  // debe quedar un solo resultado
        return stack[0].toString();
    }

    // Evento click del botón calcular
    btn.addEventListener('click', () => {  // ES6: arrow function
        const expr = (document.getElementById('expresion').value||'').trim();  // obtener input

        if(!expr){ alert('Escribe una expresión.'); return; }  // validación vacía
        if(!validacion.test(expr)) { alert("Expresión inválida (solo números, operadores y paréntesis)."); return; }

        try{
            // Tokenización y validaciones
            const tk = tok(expr);
            console.log('Tokens:', tk);
            if(!parenOK(tk)) return alert("Paréntesis desbalanceados.");
            if(!seqOK(tk)) return alert("Secuencia inválida.");

            // Convertir a RPN y AST
            const rpn = toRPN(tk);
            const ast = rpn2ast(rpn);

            // Recorridos con medición de tiempo
            const startIn = performance.now();
            const inord = inorden(ast).join(" ");
            const endIn = performance.now();

            const startPre = performance.now();
            const preord = preorden(ast).join(" ");
            const endPre = performance.now();

            const startPost = performance.now();
            const postord = postorden(ast).join(" ");
            const endPost = performance.now();

            // Evaluar resultado
            const result = evalRPN(rpn);

            // Mostrar resultados en HTML
            recorridos.innerHTML = `
            <ul>
                <li><b>Notación Infija:</b> ${inord} (<b>Tiempo:</b> ${(endIn-startIn).toFixed(3)} ms)</li>
                <li><b>Notación Prefija:</b> ${preord} (<b>Tiempo:</b> ${(endPre-startPre).toFixed(3)} ms)</li>
                <li><b>Notación Postfija:</b> ${postord} (<b>Tiempo:</b> ${(endPost-startPost).toFixed(3)} ms)</li>
            </ul>
            <p><b>Resultado de la operación:</b> ${result}</p>
            `;
        } catch(e){
            console.error(e);
            alert('Error: ' + (e && e.message ? e.message : e));  // manejo de errores
        }
    });
});
