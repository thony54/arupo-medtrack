import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import readline from 'readline';
import fs from 'fs';

// Cargar variables de entorno
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const ask = (question) => new Promise(resolve => rl.question(question, resolve));

async function main() {
  console.log('\n=======================================');
  console.log('  HERRAMIENTA DE BORRADO RÁPIDO (CLI)');
  console.log('=======================================\n');
  console.log('Selecciona qué deseas borrar:');
  console.log('1. Medicamentos (y su historial/lotes asociados)');
  console.log('2. Donantes');
  console.log('3. Beneficiarios');
  console.log('4. Borrar TODO de las 3 tablas (Peligro)');
  console.log('0. Salir\n');

  const opcion = await ask('Opción: ');

  switch (opcion.trim()) {
    case '1':
      await menuMedicamentos();
      break;
    case '2':
      await menuDonantes();
      break;
    case '3':
      await menuBeneficiarios();
      break;
    case '4':
      await borrarTodo();
      break;
    case '0':
      console.log('Saliendo...');
      rl.close();
      return;
    default:
      console.log('Opción no válida.');
      break;
  }
  
  if (opcion !== '0') {
    setTimeout(main, 1000); // Volver al menú
  }
}

async function menuMedicamentos() {
  const { data: medicinas, error } = await supabase.from('medicinas').select('*').order('nombre');
  if (error) return console.error('Error fetching medicinas:', error);
  
  if (!medicinas || medicinas.length === 0) {
    return console.log('No hay medicamentos registrados.');
  }

  console.log('\n--- Lista de Medicamentos ---');
  medicinas.forEach((m, index) => {
    console.log(`${index + 1}. ${m.nombre} (Stock: ${m.stock_actual})`);
  });
  console.log('0. Cancelar');
  console.log('A. Borrar TODOS los medicamentos');

  const resp = await ask('\nElige el número a borrar (o A para todos): ');
  
  if (resp.trim().toUpperCase() === 'A') {
    const confirm = await ask('¿Estás SEGURO de borrar TODOS los medicamentos? Esto borrará sus movimientos y lotes. (s/n): ');
    if (confirm.toLowerCase() === 's') {
      console.log('Borrando movimientos asociados...');
      await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      console.log('Borrando medicamentos...');
      const { error: errDel } = await supabase.from('medicinas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (errDel) console.error('Error:', errDel);
      else console.log('✅ Todos los medicamentos han sido borrados.');
    }
  } else if (!isNaN(resp) && parseInt(resp) > 0 && parseInt(resp) <= medicinas.length) {
    const m = medicinas[parseInt(resp) - 1];
    // Eliminar movimientos primero por la restricción RESTRICT
    console.log(`Borrando movimientos de ${m.nombre}...`);
    await supabase.from('movimientos').delete().eq('medicina_id', m.id);
    console.log(`Borrando medicamento ${m.nombre}...`);
    const { error: errDel } = await supabase.from('medicinas').delete().eq('id', m.id);
    if (errDel) console.error('Error:', errDel);
    else console.log('✅ Medicamento borrado con éxito.');
  }
}

async function menuDonantes() {
  const { data: donantes, error } = await supabase.from('donantes').select('*').order('nombre');
  if (error) return console.error('Error fetching donantes:', error);
  
  if (!donantes || donantes.length === 0) {
    return console.log('No hay donantes registrados.');
  }

  console.log('\n--- Lista de Donantes ---');
  donantes.forEach((d, index) => {
    console.log(`${index + 1}. ${d.nombre} (${d.tipo})`);
  });
  console.log('0. Cancelar');
  console.log('A. Borrar TODOS los donantes');

  const resp = await ask('\nElige el número a borrar (o A para todos): ');
  
  if (resp.trim().toUpperCase() === 'A') {
    const confirm = await ask('¿Estás SEGURO de borrar TODOS los donantes? (s/n): ');
    if (confirm.toLowerCase() === 's') {
      const { error: errDel } = await supabase.from('donantes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (errDel) console.error('Error:', errDel);
      else console.log('✅ Todos los donantes han sido borrados.');
    }
  } else if (!isNaN(resp) && parseInt(resp) > 0 && parseInt(resp) <= donantes.length) {
    const d = donantes[parseInt(resp) - 1];
    console.log(`Borrando donante ${d.nombre}...`);
    const { error: errDel } = await supabase.from('donantes').delete().eq('id', d.id);
    if (errDel) console.error('Error:', errDel);
    else console.log('✅ Donante borrado con éxito.');
  }
}

async function menuBeneficiarios() {
  const { data: beneficiarios, error } = await supabase.from('beneficiarios').select('*').order('nombre_completo');
  if (error) return console.error('Error fetching beneficiarios:', error);
  
  if (!beneficiarios || beneficiarios.length === 0) {
    return console.log('No hay beneficiarios registrados.');
  }

  console.log('\n--- Lista de Beneficiarios ---');
  beneficiarios.forEach((b, index) => {
    console.log(`${index + 1}. ${b.nombre_completo}`);
  });
  console.log('0. Cancelar');
  console.log('A. Borrar TODOS los beneficiarios');

  const resp = await ask('\nElige el número a borrar (o A para todos): ');
  
  if (resp.trim().toUpperCase() === 'A') {
    const confirm = await ask('¿Estás SEGURO de borrar TODOS los beneficiarios? (s/n): ');
    if (confirm.toLowerCase() === 's') {
      const { error: errDel } = await supabase.from('beneficiarios').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (errDel) console.error('Error:', errDel);
      else console.log('✅ Todos los beneficiarios han sido borrados.');
    }
  } else if (!isNaN(resp) && parseInt(resp) > 0 && parseInt(resp) <= beneficiarios.length) {
    const b = beneficiarios[parseInt(resp) - 1];
    console.log(`Borrando beneficiario ${b.nombre_completo}...`);
    const { error: errDel } = await supabase.from('beneficiarios').delete().eq('id', b.id);
    if (errDel) console.error('Error:', errDel);
    else console.log('✅ Beneficiario borrado con éxito.');
  }
}

async function borrarTodo() {
  const confirm = await ask('¿Estás ABSOLUTAMENTE SEGURO de querer borrar TODOS los medicamentos, movimientos, donantes y beneficiarios? (ESCRIBE "SI" PARA CONFIRMAR): ');
  if (confirm === 'SI') {
    console.log('Borrando movimientos...');
    await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Borrando medicinas (y lotes en cascada)...');
    await supabase.from('medicinas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Borrando donantes...');
    await supabase.from('donantes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('Borrando beneficiarios...');
    await supabase.from('beneficiarios').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    console.log('✅ Base de datos limpiada de registros principales.');
  } else {
    console.log('Operación cancelada.');
  }
}

main().catch(console.error);
