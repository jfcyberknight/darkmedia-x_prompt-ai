/* =============================================
   Configuration globale et helpers DOM
   ============================================= */

export const APP_VERSION = '2.1.1';

export const $ = id => document.getElementById(id);
export const qs = (sel, ctx = document) => ctx.querySelector(sel);
