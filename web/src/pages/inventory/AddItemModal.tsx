// =============================================================
// VetRx — AddItemModal.tsx
// Creates Master Inventory Item for Medicine, Consumable, Lab, Surgical, Other.
// =============================================================

import React, { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { inventoryApi, type InventoryCategory, type InventoryItem } from '../../services/inventoryApi';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (item: InventoryItem) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [category, setCategory] = useState<InventoryCategory>('MEDICINE');
  const [name, setName] = useState('');
  const [genericName, setGenericName] = useState('');
  const [strength, setStrength] = useState('');
  const [dosageForm, setDosageForm] = useState('Injection');
  const [packSize, setPackSize] = useState('30 ml');
  const [stockUnit, setStockUnit] = useState('Vial');
  const [presentation, setPresentation] = useState('Injection, 30 ml vial');
  const [manufacturer, setManufacturer] = useState('');
  const [minimumStockLevel, setMinimumStockLevel] = useState(5);
  const [targetStockLevel, setTargetStockLevel] = useState(20);
  const [barcode, setBarcode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  // Auto-compose presentation display string for medicines
  const handlePresentationUpdate = (form: string, size: string, unit: string) => {
    setDosageForm(form);
    setPackSize(size);
    setStockUnit(unit);
    if (form && size && unit) {
      setPresentation(`${form}, ${size} ${unit.toLowerCase()}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Item name is required');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      const res = await inventoryApi.createItem({
        category,
        name: name.trim(),
        genericName: category === 'MEDICINE' ? genericName.trim() || undefined : undefined,
        strength: category === 'MEDICINE' ? strength.trim() || undefined : undefined,
        dosageForm: category === 'MEDICINE' ? dosageForm.trim() || undefined : undefined,
        packSize: packSize.trim() || undefined,
        stockUnit: stockUnit.trim() || 'Unit',
        presentation: presentation.trim() || undefined,
        manufacturer: manufacturer.trim() || undefined,
        minimumStockLevel: Number(minimumStockLevel) || 0,
        targetStockLevel: Number(targetStockLevel) || 0,
        barcode: barcode.trim() || undefined,
      });

      onSuccess(res.item);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create inventory item');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="inv-modal-overlay">
      <div className="inv-modal-card">
        <div className="inv-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(0, 104, 95, 0.1)',
                color: 'var(--color-primary, #00685f)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="box" size={18} />
            </div>
            <h2 className="inv-modal-title">Add Inventory Master Item</h2>
          </div>
          <button type="button" className="inv-close-btn" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>

        {error && (
          <div className="inv-warning-banner" style={{ background: '#fef2f2', borderColor: '#fecaca', color: '#991b1b' }}>
            <Icon name="alert-triangle" size={18} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="form-label">Item Category</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
              {(['MEDICINE', 'CONSUMABLE', 'LAB_MATERIAL', 'SURGICAL_MATERIAL', 'OTHER'] as InventoryCategory[]).map(
                (cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`inventory-cat-pill ${category === cat ? 'active' : ''}`}
                    onClick={() => {
                      setCategory(cat);
                      if (cat !== 'MEDICINE') {
                        setStockUnit('Piece');
                        setDosageForm('');
                        setPresentation('');
                      } else {
                        setStockUnit('Vial');
                        setDosageForm('Injection');
                        setPresentation('Injection, 30 ml vial');
                      }
                    }}
                  >
                    {cat.replace('_', ' ')}
                  </button>
                )
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '14px' }}>
            <div>
              <label className="form-label" htmlFor="inv-item-name">
                Item Name *
              </label>
              <input
                id="inv-item-name"
                type="text"
                className="form-input"
                placeholder={category === 'MEDICINE' ? 'e.g. Ceftriaxone 1g' : 'e.g. 5ml Syringe with needle'}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-manufacturer">
                Manufacturer / Brand
              </label>
              <input
                id="inv-manufacturer"
                type="text"
                className="form-input"
                placeholder="e.g. Intas Pharmaceuticals"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>
          </div>

          {category === 'MEDICINE' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
              <div>
                <label className="form-label" htmlFor="inv-generic-name">
                  Generic Composition
                </label>
                <input
                  id="inv-generic-name"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ceftriaxone Sodium"
                  value={genericName}
                  onChange={(e) => setGenericName(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="inv-strength">
                  Strength
                </label>
                <input
                  id="inv-strength"
                  type="text"
                  className="form-input"
                  placeholder="e.g. 1 g or 500 mg"
                  value={strength}
                  onChange={(e) => setStrength(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" htmlFor="inv-dosage-form">
                  Dosage Form
                </label>
                <select
                  id="inv-dosage-form"
                  className="form-input"
                  value={dosageForm}
                  onChange={(e) => handlePresentationUpdate(e.target.value, packSize, stockUnit)}
                >
                  <option value="Injection">Injection</option>
                  <option value="Tablet">Tablet</option>
                  <option value="Syrup">Syrup</option>
                  <option value="Oral Suspension">Oral Suspension</option>
                  <option value="Eye Drops">Eye Drops</option>
                  <option value="Ear Drops">Ear Drops</option>
                  <option value="Ointment">Ointment</option>
                  <option value="Spray">Spray</option>
                  <option value="Powder">Powder</option>
                  <option value="Solution">Solution</option>
                </select>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px' }}>
            <div>
              <label className="form-label" htmlFor="inv-pack-size">
                Pack Size
              </label>
              <input
                id="inv-pack-size"
                type="text"
                className="form-input"
                placeholder={category === 'MEDICINE' ? 'e.g. 30 ml or 10 tabs' : 'e.g. Pack of 100'}
                value={packSize}
                onChange={(e) => handlePresentationUpdate(dosageForm, e.target.value, stockUnit)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-stock-unit">
                Stock Unit
              </label>
              <input
                id="inv-stock-unit"
                type="text"
                className="form-input"
                placeholder="e.g. Vial, Bottle, Strip, Piece"
                value={stockUnit}
                onChange={(e) => handlePresentationUpdate(dosageForm, packSize, e.target.value)}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-presentation">
                Presentation Display
              </label>
              <input
                id="inv-presentation"
                type="text"
                className="form-input"
                value={presentation}
                onChange={(e) => setPresentation(e.target.value)}
                placeholder="e.g. Injection, 30 ml vial"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '14px' }}>
            <div>
              <label className="form-label" htmlFor="inv-min-stock">
                Min Stock Level
              </label>
              <input
                id="inv-min-stock"
                type="number"
                min="0"
                className="form-input"
                value={minimumStockLevel}
                onChange={(e) => setMinimumStockLevel(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-target-stock">
                Target Stock Level
              </label>
              <input
                id="inv-target-stock"
                type="number"
                min="0"
                className="form-input"
                value={targetStockLevel}
                onChange={(e) => setTargetStockLevel(Number(e.target.value))}
              />
            </div>

            <div>
              <label className="form-label" htmlFor="inv-barcode">
                Barcode (Optional)
              </label>
              <input
                id="inv-barcode"
                type="text"
                className="form-input"
                placeholder="Scan or enter barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting} id="btn-save-inv-item">
              {isSubmitting ? 'Creating Item...' : 'Create Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
