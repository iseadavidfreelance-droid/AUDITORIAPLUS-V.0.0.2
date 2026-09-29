import React, { useState, useEffect } from 'react';
import { FileEdit, CheckCircle2, X, Barcode, FolderTree, Tag, Info } from 'lucide-react';

export interface SkuFichaCompletedPayload {
  skuCode: string;
  description: string;
  department: string;
  group: string;
  additionalBarcode?: string;
  completedAt: string;
}

interface ModalFichaIncompletaProps {
  isOpen: boolean;
  skuCode: string;
  initialDescription?: string;
  onClose: () => void;
  onSkuFichaCompleted: (payload: SkuFichaCompletedPayload) => void;
}

const DEPARTMENTS = [
  'Abarrotes y Alimentos',
  'Farmacia y Salud',
  'Cuidado Personal y Belleza',
  'Limpieza y Hogar',
  'Perecederos y Refrigerados',
  'Bebidas y Licores',
  'Textil y Confección',
  'Ferretería y Bazar',
];

const GROUPS_BY_DEPARTMENT: Record<string, string[]> = {
  'Abarrotes y Alimentos': ['Alimentos Secos', 'Enlatados y Conservas', 'Harinas y Pastas', 'Snacks y Confitería'],
  'Farmacia y Salud': ['Medicamentos Éticos', 'OTC / Venta Libre', 'Suplementos y Vitaminas', 'Primeros Auxilios'],
  'Cuidado Personal y Belleza': ['Higiene Oral', 'Cuidado Capilar', 'Jabones y Desodorantes', 'Cosmética'],
  'Limpieza y Hogar': ['Detergentes y Suavizantes', 'Desinfectantes', 'Papel e Higiénicos', 'Útiles de Limpieza'],
  'Perecederos y Refrigerados': ['Lácteos y Derivados', 'Embutidos y Carnes', 'Frutas y Verduras', 'Panadería'],
  'Bebidas y Licores': ['Aguas y Refrescos', 'Jugos y Bebidas Isotónicas', 'Cervezas y Vinos', 'Licores'],
  'Textil y Confección': ['Ropa Infantil', 'Ropa Adultos', 'Calzado', 'Blancos y Ropa de Cama'],
  'Ferretería y Bazar': ['Herramientas Menores', 'Iluminación y Eléctricos', 'Plásticos', 'Pilas y Accesorios'],
};

/**
 * Modal B (Ficha Incompleta) - AUDITORIAPLUS+
 * 
 * Regla FAD:
 * Se activa si IsFichaComplete = false. Despliega un formulario con inputs:
 * Descripción, Departamento (select), Grupo (select) y Código de Barras Adicional (opcional).
 * Botón CTA Verde (#009045) para emitir el evento SkuFichaCompleted.
 */
export const ModalFichaIncompleta: React.FC<ModalFichaIncompletaProps> = ({
  isOpen,
  skuCode,
  initialDescription = '',
  onClose,
  onSkuFichaCompleted,
}) => {
  const [description, setDescription] = useState(initialDescription);
  const [department, setDepartment] = useState(DEPARTMENTS[0]);
  const [group, setGroup] = useState(GROUPS_BY_DEPARTMENT[DEPARTMENTS[0]][0]);
  const [additionalBarcode, setAdditionalBarcode] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setDescription(initialDescription);
    setErrorMsg(null);
  }, [initialDescription, skuCode]);

  // Al cambiar departamento, reajustar grupo
  const handleDepartmentChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDept = e.target.value;
    setDepartment(newDept);
    const groups = GROUPS_BY_DEPARTMENT[newDept] || ['General'];
    setGroup(groups[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) {
      setErrorMsg('La descripción del producto es obligatoria para completar la ficha.');
      return;
    }

    const payload: SkuFichaCompletedPayload = {
      skuCode: skuCode.trim(),
      description: description.trim(),
      department,
      group,
      additionalBarcode: additionalBarcode.trim() || undefined,
      completedAt: new Date().toISOString(),
    };

    onSkuFichaCompleted(payload);
  };

  if (!isOpen) return null;

  const currentGroups = GROUPS_BY_DEPARTMENT[department] || ['General'];

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="w-full max-w-lg bg-slate-900 border-2 border-[#009045] rounded-2xl shadow-2xl shadow-[#009045]/20 overflow-hidden">
        {/* Cabecera Verde (#009045) */}
        <div className="bg-[#009045] px-5 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-black/20 rounded-xl">
              <FileEdit className="w-6 h-6" />
            </div>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider font-extrabold text-emerald-200 block">
                Catalogación de Terreno • Modal B
              </span>
              <h2 className="text-base font-black tracking-tight leading-tight">
                Ficha Incompleta (SKU: {skuCode})
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 hover:bg-black/20 rounded-lg text-emerald-100 hover:text-white transition cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-200">
            <Info className="w-4 h-4 text-[#009045] shrink-0 mt-0.5" />
            <p>
              El SKU escaneado no tiene ficha completa en el maestro de MaraPlus. Complete los datos mínimos para validar la auditoría física.
            </p>
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-red-950/60 border border-red-500/50 rounded-lg text-xs text-red-300 font-medium">
              {errorMsg}
            </div>
          )}

          {/* Input 1: Descripción */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              Descripción Comercial del Producto <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ej. Harina de Maíz Precocida 1Kg"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#009045] focus:ring-1 focus:ring-[#009045]"
            />
          </div>

          {/* Input 2: Departamento (select) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-emerald-400" />
                Departamento <span className="text-red-400">*</span>
              </label>
              <select
                value={department}
                onChange={handleDepartmentChange}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#009045] focus:ring-1 focus:ring-[#009045] cursor-pointer"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Input 3: Grupo (select) */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <FolderTree className="w-3.5 h-3.5 text-cyan-400" />
                Grupo de Artículos <span className="text-red-400">*</span>
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-[#009045] focus:ring-1 focus:ring-[#009045] cursor-pointer"
              >
                {currentGroups.map((grp) => (
                  <option key={grp} value={grp}>
                    {grp}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Input 4: Código de Barras Adicional (Opcional) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <Barcode className="w-3.5 h-3.5 text-slate-400" />
              Código de Barras Adicional (EAN/UPC alterno)
              <span className="text-slate-500 font-normal">(Opcional)</span>
            </label>
            <input
              type="text"
              value={additionalBarcode}
              onChange={(e) => setAdditionalBarcode(e.target.value)}
              placeholder="Ej. 759103100246 (secundario o bulto)"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-sm font-mono text-white placeholder-slate-500 focus:outline-none focus:border-[#009045] focus:ring-1 focus:ring-[#009045]"
            />
          </div>

          {/* Botón CTA Verde (#009045) */}
          <div className="pt-2 flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-slate-800 hover:bg-slate-750 text-slate-300 font-semibold text-xs rounded-xl border border-slate-700 transition cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-[2] py-3 bg-[#009045] hover:bg-[#007b3b] text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-lg shadow-[#009045]/30 flex items-center justify-center gap-2 active:scale-[0.98] cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Completar Ficha (SkuFichaCompleted)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
