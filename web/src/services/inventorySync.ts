// ==============================================================================
// VetRx — inventorySync.ts
// Syncs Inventory medicines into client-side formulary (Dexie db.medicines)
// so that inventory stock items are instantly available in Prescription Builder.
// ==============================================================================

import { db } from '../db/schema';
import { inventoryApi } from './inventoryApi';

let backendBackfillDone = false;

export async function syncInventoryMedicinesToFormulary(): Promise<number> {
  try {
    if (!backendBackfillDone) {
      backendBackfillDone = true;
      try {
        await inventoryApi.syncCatalogues();
      } catch {
        // Non-fatal: backfill is a safety net; confirm-time linking is primary.
      }
    }
    const res = await inventoryApi.getItems();
    // Strictly sync MEDICINE category items (never consumables, surgical, or lab materials)
    const items = (res.items || []).filter((it) => it.category === 'MEDICINE');
    let changedCount = 0;

    for (const it of items) {
      const name = it.name?.trim();
      if (!name) continue;

      const existing = await db.medicines.where('brandName').equalsIgnoreCase(name).first();
      if (!existing) {
        await db.medicines.add({
          brandName: name,
          genericName: it.genericName?.trim() || undefined,
          presentation: it.presentation || it.dosageForm || 'Tablet',
          strength: it.strength?.trim() || undefined,
          packSize: it.packSize || undefined,
          defaultUnit: it.stockUnit || 'Unit',
          dispenseUnit: it.stockUnit || 'Unit',
          category: 'Allopathy',
          notes: it.manufacturer ? `Manufacturer: ${it.manufacturer}` : undefined,
          isActive: it.isActive !== false,
          source: 'manual',
          dosingMethod: 'none',
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        changedCount++;
      } else {
        // Enrich existing medicine with any missing details from stock catalogue without overwriting clinical data
        const updates: any = {};
        if (!existing.genericName && it.genericName) updates.genericName = it.genericName.trim();
        if ((!existing.presentation || existing.presentation === 'Tablet') && it.presentation) updates.presentation = it.presentation.trim();
        if (!existing.strength && it.strength) updates.strength = it.strength.trim();
        if (!existing.packSize && it.packSize) updates.packSize = it.packSize.trim();
        if (!existing.dispenseUnit && it.stockUnit) updates.dispenseUnit = it.stockUnit.trim();
        if (!existing.notes && it.manufacturer) updates.notes = `Manufacturer: ${it.manufacturer}`.trim();

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = new Date();
          await db.medicines.update(existing.id!, updates);
          changedCount++;
        }
      }
    }

    if (changedCount > 0) {
      console.log(`[inventorySync] Successfully synced/updated ${changedCount} inventory medicine(s) in formulary.`);
    }
    return changedCount;
  } catch (err) {
    console.warn('[inventorySync] Failed to sync inventory medicines:', err);
    return 0;
  }
}
