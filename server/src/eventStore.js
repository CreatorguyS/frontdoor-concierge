/**
 * Event & Security Store — FrontDoor Concierge
 * In-memory + persistent JSON store with atomic writes & PIN management
 */

import { readFileSync, writeFileSync, renameSync, existsSync } from 'fs';
import { resolve } from 'path';

const EVENTS_PATH = resolve(process.cwd(), 'events.json');
const PINS_PATH   = resolve(process.cwd(), 'pins.json');

export class EventStore {
  constructor() {
    this.events = this._loadEvents();
    this.pins   = this._loadPins();
  }

  // ─── Event Storage ──────────────────────────────────────────
  _loadEvents() {
    try {
      if (existsSync(EVENTS_PATH)) {
        const data = JSON.parse(readFileSync(EVENTS_PATH, 'utf-8'));
        return Array.isArray(data) ? data.slice(-300) : [];
      }
    } catch (err) {
      console.warn('[Store] Could not load events.json, starting fresh:', err.message);
    }
    return [];
  }

  _saveEvents() {
    try {
      const tempPath = `${EVENTS_PATH}.tmp`;
      writeFileSync(tempPath, JSON.stringify(this.events.slice(-500), null, 2));
      renameSync(tempPath, EVENTS_PATH);
    } catch (err) {
      console.error('[Store] Atomic write failed for events.json:', err.message);
    }
  }

  append(event) {
    this.events.push(event);
    this._saveEvents();
  }

  update(id, updatedEvent) {
    const idx = this.events.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.events[idx] = updatedEvent;
      this._saveEvents();
    }
  }

  getAll() {
    return [...this.events].reverse(); // newest first
  }

  count() {
    return this.events.length;
  }

  clear() {
    this.events = [];
    this._saveEvents();
  }

  // ─── Smart Lock PIN Storage & Expiration ────────────────────
  _loadPins() {
    try {
      if (existsSync(PINS_PATH)) {
        const data = JSON.parse(readFileSync(PINS_PATH, 'utf-8'));
        return Array.isArray(data) ? data : [];
      }
    } catch {}
    return [];
  }

  _savePins() {
    try {
      const tempPath = `${PINS_PATH}.tmp`;
      writeFileSync(tempPath, JSON.stringify(this.pins, null, 2));
      renameSync(tempPath, PINS_PATH);
    } catch {}
  }

  savePin(pinRecord) {
    // de-activate older pins for same recipient if desired or append
    this.pins.unshift(pinRecord);
    // keep only last 50 pins
    if (this.pins.length > 50) this.pins = this.pins.slice(0, 50);
    this._savePins();
    return pinRecord;
  }

  getActivePins() {
    const now = Date.now();
    return this.pins.filter(p => p.status === 'active' && new Date(p.expiresAt).getTime() > now);
  }

  getAllPins() {
    return this.pins;
  }

  verifyAndUnlock(pin) {
    const cleanPin = String(pin).trim();
    const now = Date.now();
    const record = this.pins.find(p => p.pin === cleanPin);

    if (!record) {
      return { success: false, reason: 'PIN code not found in security ledger' };
    }

    if (record.status === 'used') {
      return { success: false, reason: 'This one-time PIN has already been used' };
    }

    if (new Date(record.expiresAt).getTime() < now) {
      record.status = 'expired';
      this._savePins();
      return { success: false, reason: 'PIN has expired' };
    }

    // Valid PIN! Mark as used
    record.status = 'used';
    record.usedAt = new Date().toISOString();
    this._savePins();

    return {
      success: true,
      recipient: record.recipient,
      unlockDurationSeconds: 60,
      timestamp: record.usedAt,
    };
  }

  cleanupExpiredPins() {
    const now = Date.now();
    let updated = false;
    this.pins.forEach(p => {
      if (p.status === 'active' && new Date(p.expiresAt).getTime() <= now) {
        p.status = 'expired';
        updated = true;
      }
    });
    if (updated) this._savePins();
  }

  // ─── Analytics ──────────────────────────────────────────────
  getStats() {
    const now = Date.now();
    const today = this.events.filter(e => (now - new Date(e.timestamp).getTime()) < 86400000);

    const deliveries = today.filter(e => ['doorbell_pressed', 'package_detected'].includes(e.type));
    const alerts     = today.filter(e => e.aiAnalysis?.riskScore >= 6);
    const motions    = today.filter(e => e.type === 'motion_detected');

    // Carrier breakdown
    const carriers = {};
    this.events.forEach(e => {
      const c = e.aiAnalysis?.carrierName;
      if (c && c !== 'null' && c !== null) {
        carriers[c] = (carriers[c] || 0) + 1;
      }
    });

    // Hourly distribution (last 24h)
    const hourly = Array(24).fill(0);
    today.forEach(e => {
      const h = new Date(e.timestamp).getHours();
      hourly[h]++;
    });

    const avgRisk = today.length > 0
      ? (today.reduce((sum, e) => sum + (e.aiAnalysis?.riskScore || 0), 0) / today.length).toFixed(1)
      : 0;

    return {
      todayTotal: today.length,
      deliveries: deliveries.length,
      highRiskAlerts: alerts.length,
      motionEvents: motions.length,
      avgRiskScore: parseFloat(avgRisk),
      carriers,
      hourlyActivity: hourly,
      packageSuccess: deliveries.filter(e => e.aiAnalysis?.riskScore <= 3).length,
      activePinsCount: this.getActivePins().length,
    };
  }
}
