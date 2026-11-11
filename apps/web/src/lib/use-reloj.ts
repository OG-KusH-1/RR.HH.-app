"use client";
import { useSyncExternalStore } from "react";

const INTERVALO = 20_000;

function suscribir(avisar: () => void) {
  const id = setInterval(avisar, INTERVALO);
  return () => clearInterval(id);
}

/** Instante redondeado al intervalo, para que la instantánea sea estable entre renders. */
const instantanea = () => Math.floor(Date.now() / INTERVALO) * INTERVALO;

/** La hora actual, actualizada cada 20 segundos. null en el servidor, para no desajustar la hidratación. */
export function useReloj(): Date | null {
  const ms = useSyncExternalStore(suscribir, instantanea, () => null);
  return ms === null ? null : new Date(ms);
}
