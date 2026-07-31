import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Cargar variables de entorno
const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;

// ─────────────────────────────────────────────────────────────
// SEGURO CONTRA EJECUCIÓN ACCIDENTAL
// Este script BORRA TODOS LOS DATOS de la base a la que apunte
// .env.local, que hoy es PRODUCCIÓN. Antes bastaba con `node
// clean_db.js` — sin confirmación, sin aviso, sin vuelta atrás.
// ─────────────────────────────────────────────────────────────
if (process.env.MEDTRACK_CONFIRMAR_BORRADO !== 'SI-BORRAR-TODO') {
  console.error('\n⛔ Ejecución bloqueada.\n');
  console.error('Este script borra movimientos, lotes, medicinas, donantes y');
  console.error('beneficiarios de la base:');
  console.error(`   ${supabaseUrl}\n`);
  console.error('Si es REALMENTE lo que quieres, vuelve a lanzarlo así:\n');
  console.error('   PowerShell:  $env:MEDTRACK_CONFIRMAR_BORRADO="SI-BORRAR-TODO"; node clean_db.js');
  console.error('   Bash:        MEDTRACK_CONFIRMAR_BORRADO=SI-BORRAR-TODO node clean_db.js\n');
  console.error('Antes de hacerlo, comprueba que esa URL NO es la de producción.\n');
  process.exit(1);
}

console.warn(`\n⚠️  Borrando datos de: ${supabaseUrl}\n`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function clean() {
  console.log('==================================================');
  console.log('  INICIANDO LIMPIEZA Y RESTAURACIÓN DE FÁBRICA');
  console.log('==================================================\n');
  
  try {
    // 1. Borrar Movimientos (Historial de transacciones)
    console.log('-> Borrando movimientos de inventario...');
    const { error: errMov } = await supabase.from('movimientos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errMov) console.error('   Error al borrar movimientos:', errMov.message);
    else console.log('   ✓ Movimientos eliminados.');

    // 2. Borrar Lotes (Control unitario FEFO/FIFO)
    console.log('-> Borrando lotes...');
    const { error: errLot } = await supabase.from('lotes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errLot) console.error('   Error al borrar lotes:', errLot.message);
    else console.log('   ✓ Lotes eliminados.');

    // 3. Borrar Medicinas (Catálogo de productos)
    console.log('-> Borrando medicinas e ítems generales...');
    const { error: errMed } = await supabase.from('medicinas').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errMed) console.error('   Error al borrar medicinas:', errMed.message);
    else console.log('   ✓ Catálogo de productos eliminado.');

    // 4. Borrar Categorías
    console.log('-> Borrando categorías...');
    const { error: errCat } = await supabase.from('categorias').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errCat) console.error('   Error al borrar categorías:', errCat.message);
    else console.log('   ✓ Categorías eliminadas.');

    // 5. Borrar Donantes (Directorio)
    console.log('-> Borrando donantes...');
    const { error: errDon } = await supabase.from('donantes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errDon) console.error('   Error al borrar donantes:', errDon.message);
    else console.log('   ✓ Donantes eliminados.');

    // 6. Borrar Beneficiarios (Directorio)
    console.log('-> Borrando beneficiarios...');
    const { error: errBen } = await supabase.from('beneficiarios').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errBen) console.error('   Error al borrar beneficiarios:', errBen.message);
    else console.log('   ✓ Beneficiarios eliminados.');

    // 7. Restaurar Categorías Semilla (Factory Default)
    console.log('-> Re-insertando categorías de fábrica...');
    const seedCategories = [
      { nombre: 'Analgésicos', descripcion: 'Medicamentos para aliviar el dolor' },
      { nombre: 'Antibióticos', descripcion: 'Tratamiento de infecciones bacterianas' },
      { nombre: 'Antihipertensivos', descripcion: 'Control de la presión arterial' }
    ];
    const { error: errSeed } = await supabase.from('categorias').insert(seedCategories);
    if (errSeed) console.error('   Error al insertar categorías semilla:', errSeed.message);
    else console.log('   ✓ Categorías semilla restauradas con éxito.');

    console.log('\n==================================================');
    console.log('  🎉 ¡BASE DE DATOS RESTAURADA DE FÁBRICA CON ÉXITO!');
    console.log('==================================================');
    console.log('  - Todos los usuarios de Supabase Auth se preservaron.');
    console.log('  - Se eliminaron todos los ítems, lotes, movimientos, donantes y beneficiarios.');
  } catch (err) {
    console.error('\n[X] Ocurrió un error inesperado durante la limpieza:', err.message);
  }
}

clean();
