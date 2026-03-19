const VENTAS_ENVIOS_SYNC_EVENT = 'ventas-envios-sync';

export type VentasEnviosSyncSource = 'ventas' | 'envios' | 'system';

type VentasEnviosSyncDetail = {
  source: VentasEnviosSyncSource;
};

export const emitVentasEnviosSync = (source: VentasEnviosSyncSource = 'system') => {
  const event = new CustomEvent<VentasEnviosSyncDetail>(VENTAS_ENVIOS_SYNC_EVENT, {
    detail: { source },
  });
  window.dispatchEvent(event);
};

export const subscribeVentasEnviosSync = (handler: (source: VentasEnviosSyncSource) => void) => {
  const listener = (event: Event) => {
    const customEvent = event as CustomEvent<VentasEnviosSyncDetail>;
    handler(customEvent.detail?.source ?? 'system');
  };
  window.addEventListener(VENTAS_ENVIOS_SYNC_EVENT, listener);
  return () => {
    window.removeEventListener(VENTAS_ENVIOS_SYNC_EVENT, listener);
  };
};
