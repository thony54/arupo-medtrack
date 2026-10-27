import React, { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutGrid, X, Search, ChevronRight, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../i18n/useI18n';
import { getRolColor } from '../../utils/roles';
import './mobile-nav.css';

// Navegación del teléfono: un dock flotante con los atajos que más se usan y, cuando la
// persona tiene más módulos de los que caben, un botón "Menú" que abre un panel con todos
// agrupados por área. Con 4 módulos o menos, el dock los muestra todos y no hay panel.
//
// `secciones`: [{ clave, titulo, rgb, items: [{ to, icon, label, rgb?, corto?, end?, rutas?, pin? }] }]
//   · `pin`: prioridad para entrar al dock (menor = antes); sin `pin`, solo vive en el panel.
//   · `rutas`: prefijos extra que también cuentan como "estoy en este módulo".
const HUECOS_DOCK = 4;

const coincide = (item, ruta) =>
  [item.to, ...(item.rutas || [])].some((base) =>
    item.end ? ruta === base : ruta === base || ruta.startsWith(`${base}/`)
  );

const sinTildes = (texto) => texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export const MobileNav = ({ secciones, etiquetaRol, onLogout }) => {
  const { profile } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const [abierto, setAbierto] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [rutaVista, setRutaVista] = useState(pathname);
  const panelRef = useRef(null);
  const botonMenuRef = useRef(null);

  // Al cambiar de página (también con el botón "atrás") el panel se cierra solo.
  if (rutaVista !== pathname) {
    setRutaVista(pathname);
    setAbierto(false);
    setBusqueda('');
  }

  const todos = secciones.flatMap((s) => s.items);
  const cabeTodo = todos.length <= HUECOS_DOCK;
  const fijos = cabeTodo
    ? todos
    : [...todos]
        .sort((a, b) => (a.pin ?? 99) - (b.pin ?? 99) || todos.indexOf(a) - todos.indexOf(b))
        .slice(0, HUECOS_DOCK - 1);
  const enDock = todos.filter((item) => fijos.includes(item));
  const actual = todos.find((item) => coincide(item, pathname));
  // La página actual no tiene atajo: el botón "Menú" la muestra para no perder la orientación.
  const actualFueraDelDock = actual && !enDock.includes(actual) ? actual : null;

  const cerrar = () => {
    setAbierto(false);
    setBusqueda('');
  };

  useEffect(() => {
    if (!abierto) return undefined;
    const alTeclear = (e) => { if (e.key === 'Escape') { setAbierto(false); setBusqueda(''); } };
    document.addEventListener('keydown', alTeclear);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const boton = botonMenuRef.current;
    panelRef.current?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', alTeclear);
      document.body.style.overflow = overflowPrevio;
      boton?.focus({ preventScroll: true });
    };
  }, [abierto]);

  const termino = sinTildes(busqueda.trim());
  const visibles = secciones
    .map((s) => ({ ...s, items: termino ? s.items.filter((i) => sinTildes(i.label).includes(termino)) : s.items }))
    .filter((s) => s.items.length > 0);

  return (
    <>
      <nav className={`mnav-dock ${abierto ? 'is-open' : ''}`} aria-label={t('nav.principal')}>
        {enDock.map((item) => {
          const activo = item === actual;
          const Icon = item.icon;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`mnav-tab ${activo ? 'is-active' : ''}`}
              aria-current={activo ? 'page' : undefined}
              aria-label={item.label}
            >
              <Icon size={21} aria-hidden="true" />
              <span>{item.corto ?? item.label}</span>
            </Link>
          );
        })}

        {!cabeTodo && (
          <button
            ref={botonMenuRef}
            type="button"
            className={`mnav-tab mnav-tab-menu ${abierto || actualFueraDelDock ? 'is-active' : ''}`}
            onClick={() => (abierto ? cerrar() : setAbierto(true))}
            aria-expanded={abierto}
            aria-controls="mnav-panel"
            aria-haspopup="dialog"
            aria-label={abierto ? t('nav.cerrar_menu') : t('nav.menu')}
          >
            {abierto
              ? <X size={21} aria-hidden="true" />
              : actualFueraDelDock
                ? <actualFueraDelDock.icon size={21} aria-hidden="true" />
                : <LayoutGrid size={21} aria-hidden="true" />}
            <span>
              {abierto ? t('nav.cerrar_menu') : actualFueraDelDock ? (actualFueraDelDock.corto ?? actualFueraDelDock.label) : t('nav.menu')}
            </span>
          </button>
        )}
      </nav>

      {abierto && (
        <>
          <div className="mnav-backdrop" onClick={cerrar} aria-hidden="true" />
          <div
            id="mnav-panel"
            ref={panelRef}
            className="mnav-panel"
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
            tabIndex={-1}
          >
            <div className="mnav-head">
              <Link to="/perfil" className="mnav-user" aria-label={t('nav.ver_perfil')}>
                <span
                  className="mnav-avatar"
                  style={{ background: profile?.avatar ? 'transparent' : getRolColor(profile?.rol) }}
                >
                  {profile?.avatar
                    ? <img src={profile.avatar} alt="" />
                    : (profile?.nombre || 'U').substring(0, 2).toUpperCase()}
                </span>
                <span className="mnav-user-text">
                  <strong>{profile?.nombre || t('comun.cargando')}</strong>
                  <small>{etiquetaRol}</small>
                </span>
                <ChevronRight size={18} aria-hidden="true" />
              </Link>
              <button
                type="button"
                className="mnav-logout"
                onClick={onLogout}
                aria-label={t('nav.cerrar_sesion')}
                title={t('nav.cerrar_sesion')}
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>

            {todos.length > 6 && (
              <label className="mnav-search">
                <Search size={17} aria-hidden="true" />
                <input
                  type="search"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder={t('nav.buscar_modulo')}
                  autoComplete="off"
                />
              </label>
            )}

            <div className="mnav-scroll">
              {visibles.map((s) => (
                <section key={s.clave} className="mnav-sec" style={{ '--sec-rgb': s.rgb }}>
                  <h2 className="mnav-sec-title">{s.titulo}</h2>
                  <div className="mnav-grid">
                    {s.items.map((item) => {
                      const Icon = item.icon;
                      const activo = item === actual;
                      return (
                        <Link
                          key={item.to}
                          to={item.to}
                          className={`mnav-tile ${activo ? 'is-active' : ''}`}
                          style={{ '--i': todos.indexOf(item), '--item-rgb': item.rgb ?? s.rgb }}
                          aria-current={activo ? 'page' : undefined}
                        >
                          <span className="mnav-tile-icon"><Icon size={27} strokeWidth={1.9} aria-hidden="true" /></span>
                          <span className="mnav-tile-label">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ))}
              {visibles.length === 0 && <p className="mnav-empty">{t('nav.sin_resultados')}</p>}
            </div>
          </div>
        </>
      )}
    </>
  );
};
