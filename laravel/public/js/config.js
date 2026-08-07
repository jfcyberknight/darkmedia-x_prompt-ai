/* =============================================
   Configuration globale et helpers DOM
   ============================================= */

export const APP_VERSION = '2.0.0';

export const $ = id => document.getElementById(id);
export const qs = (sel, ctx = document) => ctx.querySelector(sel);
