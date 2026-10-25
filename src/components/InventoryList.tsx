import { FluidSpinner } from "./FluidSpinner";
import { SearchableSelect } from "./SearchableSelect";
import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getSpreadsheetMetadata,
  getInventory,
  updateInventory,
  SheetRow,
  getClassInventory,
  updateClassInventory,
  getMasterItems,
  addItemToClass,
  deleteRows,
  deleteClassItems,
  getClassLastRow,
  formatClassColors,
  formatStockColors,
  appendInventoryItem,
  addTemplateItemsToClass,
  addLabTemplateItemsToClass,
  duplicateItemInClass,
  moveItemToClassOrStock,
  getClasses,
  addClassToInventory,
  deleteEntireClassOrLocation,
} from "../lib/sheets";
import {
  getCustomDropdowns,
  addCustomTag,
  addCustomType,
  CustomDropdowns,
  getMergedCustomDropdowns,
  addMergedCustomTag,
  addMergedCustomType,
} from "../lib/dropdowns";
import {
  Save,
  Bell,
  ChevronLeft,
  SlidersHorizontal,
  Filter,
  AlertCircle,
  RefreshCw,
  Plus,
  Package,
  X,
  CheckCircle2,
  Trash2,
  ScanLine,
  Search,
  Folder,
  ChevronDown,
  ChevronRight,
  Edit2,
  Cloud,
  FileText,
  Printer,
  Download,
  Copy,
  ArrowRight,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn, getItemIcon } from "../lib/utils";
import { BarcodeScanner } from "./BarcodeScanner";
import { useLanguage } from "./LanguageProvider";
import { groupStockItems, stockModelChoices } from "../lib/stockGroups";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

const FOLDER_COLORS = [
  {
    bg: "bg-indigo-50 dark:bg-indigo-900/20 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/40",
    text: "text-indigo-600 dark:text-indigo-400",
  },
  {
    bg: "bg-blue-50 dark:bg-blue-900/20 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40",
    text: "text-blue-600 dark:text-blue-400",
  },
  {
    bg: "bg-emerald-50 dark:bg-emerald-900/20 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  {
    bg: "bg-rose-50 dark:bg-rose-900/20 group-hover:bg-rose-100 dark:group-hover:bg-rose-900/40",
    text: "text-rose-600 dark:text-rose-400",
  },
  {
    bg: "bg-amber-50 dark:bg-amber-900/20 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/40",
    text: "text-amber-600 dark:text-amber-400",
  },
  {
    bg: "bg-purple-50 dark:bg-purple-900/20 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/40",
    text: "text-purple-600 dark:text-purple-400",
  },
  {
    bg: "bg-cyan-50 dark:bg-cyan-900/20 group-hover:bg-cyan-100 dark:group-hover:bg-cyan-900/40",
    text: "text-cyan-600 dark:text-cyan-400",
  },
];

const getFolderColor = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return FOLDER_COLORS[Math.abs(hash) % FOLDER_COLORS.length];
};

interface InventoryListProps {
  sheetId: string;
  tabName?: string; // If not provided, fetch metadata and use the first tab
  className?: string; // For Class Matrix Mode
  title: string;
  subtitle: string;
  type: "stock" | "class";
}

export function TagInput({
  value,
  onChange,
  isActive,
  existingTags = [],
  customTags = [],
  onAddCustom,
}: {
  value: string;
  onChange: (v: string) => void;
  isActive: boolean;
  existingTags?: string[];
  customTags?: string[];
  onAddCustom?: (tag: string) => void;
}) {
  const [isCustom, setIsCustom] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");

  const handleCustomBlur = () => {
    setIsCustom(false);
    if (localValue && localValue.trim() !== "") {
      const trimmed = localValue.trim();
      onChange(trimmed);
      if (onAddCustom) {
        onAddCustom(trimmed);
      }
    }
  };

  const defaultTags = [
    "Computer",
    "Peripheral",
    "Accessory",
    "Cable",
    "TV",
    "Interactive",
    "Other",
  ];
  const options = Array.from(
    new Set(
      [...existingTags, value, ...defaultTags, ...customTags].filter(Boolean),
    ),
  );

  if (isCustom) {
    return (
      <input
        autoFocus
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleCustomBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCustomBlur();
        }}
        className={cn(
          "w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-all border",
          isActive
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
            : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500 text-slate-900 dark:text-slate-100",
        )}
        placeholder="Type custom tag..."
      />
    );
  }

  return (
    <SearchableSelect
      aria-label="Category / tag"
      value={value || ""}
      onChange={(nextValue) => {
        if (nextValue === "__ADD_NEW__") {
          setIsCustom(true);
          setLocalValue("");
        } else {
          onChange(nextValue);
        }
      }}
      className={cn(
        "w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-all border cursor-pointer",
        isActive
          ? "border-indigo-300 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
          : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500 text-slate-700 dark:text-slate-200",
      )}
      placeholder="Select tag"
      searchPlaceholder="Search categories..."
      options={[{ value: '', label: '-- Select Tag --' }, ...options.map(opt => ({ value: opt, label: opt })), { value: '__ADD_NEW__', label: '+ Type Custom Tag...' }]}
    />
  );
}

export function TypeInput({
  value,
  tagValue,
  onChange,
  isActive,
  existingTypes = [],
  customTypes = [],
  onAddCustom,
}: {
  value: string;
  tagValue: string;
  onChange: (v: string) => void;
  isActive: boolean;
  existingTypes?: string[];
  customTypes?: string[];
  onAddCustom?: (tag: string, type: string) => void;
}) {
  const navigate = useNavigate();
  const [isCustom, setIsCustom] = useState(false);
  const [localValue, setLocalValue] = useState(value || "");

  const handleCustomBlur = () => {
    setIsCustom(false);
    if (localValue && localValue.trim() !== "") {
      const trimmed = localValue.trim();
      onChange(trimmed);
      if (onAddCustom) {
        onAddCustom(tagValue, trimmed);
      }
    }
  };

  const options = Array.from(
    new Set([...existingTypes, value, ...customTypes].filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));

  if (isCustom) {
    return (
      <input
        autoFocus
        type="text"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleCustomBlur}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleCustomBlur();
        }}
        className={cn(
          "w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-all border",
          isActive
            ? "border-indigo-300 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
            : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500 text-slate-900 dark:text-slate-100",
        )}
        placeholder="Type custom type..."
      />
    );
  }

  return (
    <SearchableSelect
      aria-label="Type / model"
      value={value || ""}
      onChange={(nextValue) => {
        if (nextValue === "__ADD_NEW__") {
          setIsCustom(true);
          setLocalValue("");
        } else if (nextValue === "__MANAGE__") {
          navigate("/types");
        } else {
          onChange(nextValue);
        }
      }}
      className={cn(
        "w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-all border cursor-pointer",
        isActive
          ? "border-indigo-300 bg-indigo-50/50 text-indigo-700 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
          : "border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700 focus:border-indigo-400 dark:focus:border-indigo-500 text-slate-700 dark:text-slate-200",
      )}
      placeholder="Select type"
      searchPlaceholder="Search types..."
      options={[{ value: '', label: '-- Select Type --' }, ...options.map(opt => ({ value: opt, label: opt })), { value: '__ADD_NEW__', label: '+ Type Custom Type...' }, { value: '__MANAGE__', label: 'Manage Types...' }]}
    />
  );
}

function DebouncedInput({ value, onChange, ...props }: any) {
  const [local, setLocal] = useState(value);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  return (
    <input
      {...props}
      value={local}
      onChange={(e) => {
        setLocal(e.target.value);
      }}
      onBlur={(e) => {
        if (local !== value) {
          onChange(e.target.value);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

export function InventoryList({
  sheetId,
  tabName,
  className,
  title,
  subtitle,
  type,
}: InventoryListProps) {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<SheetRow[]>([]);
  const [actualTabName, setActualTabName] = useState<string>("");
  const [actualSheetNumericalId, setActualSheetNumericalId] = useState<
    number | null
  >(null);
  const [masterItems, setMasterItems] = useState<string[]>([]);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [addingStatus, setAddingStatus] = useState<"idle" | "saving" | "error">(
    "idle",
  );
  const [showDeleteClassConfirm, setShowDeleteClassConfirm] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [scannerOpenIdx, setScannerOpenIdx] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"sheet" | "name" | "quantity-low" | "quantity-high">("sheet");
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [isPhone, setIsPhone] = useState(() => window.matchMedia('(max-width: 700px)').matches);
  const [visibleLimit, setVisibleLimit] = useState(30);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [selectedStockGroupKey, setSelectedStockGroupKey] = useState<string | null>(null);
  const [newGroupModel, setNewGroupModel] = useState('');
  const [isNewGroupModel, setIsNewGroupModel] = useState(false);
  const [newGroupQuantity, setNewGroupQuantity] = useState('1');
  const navigate = useNavigate();
  useEffect(() => { const query = window.matchMedia('(max-width: 700px)'); const update = () => setIsPhone(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);

  const [modifiedRows, setModifiedRows] = useState<Set<number>>(new Set());

  const [editingGroupName, setEditingGroupName] = useState("");
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState("");
  const [isAddingLocation, setIsAddingLocation] = useState(false);

  const [newItemType, setNewItemType] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState("1");
  const [newItemSnid, setNewItemSnid] = useState("");
  const [isAddingItemInline, setIsAddingItemInline] = useState(false);
  const [newItemTag, setNewItemTag] = useState("");

  const [newItemHostname, setNewItemHostname] = useState("");
  const [newItemLocation, setNewItemLocation] = useState("");

  const [showDraftReport, setShowDraftReport] = useState(false);
  const [draftReportItemQuery, setDraftReportItemQuery] = useState("");
  const [draftReportTypeQuery, setDraftReportTypeQuery] = useState("");
  const [showTextReport, setShowTextReport] = useState(false);
  const [textReportContent, setTextReportContent] = useState("");
  const [customDropdowns, setCustomDropdowns] = useState<CustomDropdowns>({
    tags: [],
    typesByTag: {},
  });

  // Move Item State
  const [itemToMove, setItemToMove] = useState<SheetRow | null>(null);
  const [moveTargetType, setMoveTargetType] = useState<
    "Classes" | "Stock Room"
  >("Classes");
  const [moveTargetName, setMoveTargetName] = useState("");
  const [customTargetName, setCustomTargetName] = useState("");
  const [moveQty, setMoveQty] = useState("1");
  const [isFetchingDestinations, setIsFetchingDestinations] = useState(false);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableStocks, setAvailableStocks] = useState<string[]>([]);
  const [isMovingItem, setIsMovingItem] = useState(false);
  const [duplicatingRows, setDuplicatingRows] = useState<Set<number>>(
    new Set(),
  );
  
  const rawThreshold = localStorage.getItem("quickStock_lowInventoryThreshold");
  const parsedThreshold = parseInt(rawThreshold || "5", 10);
  const lowInventoryThreshold = isNaN(parsedThreshold) ? 5 : parsedThreshold;

  const loadData = async (showLoading = true) => {
    if (!sheetId) {
      setError("Spreadsheet ID is not configured. Please go to Settings.");
      setLoading(false);
      return;
    }

    if (showLoading || items.length === 0) {
      setLoading(true);
    }
    setError(null);
    try {
      const meta = await getSpreadsheetMetadata(sheetId);

      let targetTab = tabName;
      let numId = null;
      if (!targetTab) {
        targetTab = meta.sheets[0]?.properties.title;
        numId = meta.sheets[0]?.properties.sheetId;
        if (!targetTab) throw new Error("No sheets found in spreadsheet");
      } else {
        let sheet = meta.sheets.find(
          (s) =>
            s.properties.title === targetTab ||
            s.properties.title.toLowerCase() === targetTab.toLowerCase(),
        );
        // Fallback for existing stock room sheets that might still be named Sheet1
        if (!sheet) {
          sheet = meta.sheets[0];
        }
        if (sheet) {
          targetTab = sheet.properties.title;
        }
        numId = sheet ? sheet.properties.sheetId : null;
      }
      setActualTabName(targetTab);
      setActualSheetNumericalId(numId);

      const promises: Promise<any>[] = [];
      let data: SheetRow[] = [];

      if (className) {
        promises.push(
          getClassInventory(sheetId, targetTab, className).then((res) => {
            data = res;
          }),
        );
      } else {
        promises.push(
          getInventory(sheetId, targetTab).then((res) => {
            data = res;
          }),
        );
      }

      if (type === "class" || type === "stock") {
        promises.push(
          getMasterItems(sheetId, "Item Master")
            .then((mItems) => setMasterItems(mItems))
            .catch((e) => console.error("Failed to load master items", e)),
        );
      }

      promises.push(
        getMergedCustomDropdowns()
          .then((cd) => setCustomDropdowns(cd))
          .catch((e) => console.error("Failed to load custom dropdowns", e)),
      );

      await Promise.all(promises);

      setItems(data);

      setModifiedRows(new Set());
    } catch (err: any) {
      setError(err.message || "Failed to load inventory.");
    } finally {
      if (showLoading || items.length === 0) {
        setLoading(false);
      }
    }
  };

  const existingTags = React.useMemo(() => {
    const tags = new Set<string>();
    items.forEach((item) => {
      if (item.tag) tags.add(item.tag);
    });
    return Array.from(tags).sort((a, b) => a.localeCompare(b));
  }, [items]);

  const existingTypesByTag = React.useMemo(() => {
    const map: Record<string, Set<string>> = {};
    items.forEach((item) => {
      if (item.tag && item.type) {
        if (!map[item.tag]) map[item.tag] = new Set();
        map[item.tag].add(item.type);
      }
    });
    const result: Record<string, string[]> = {};
    for (const tag in map) {
      result[tag] = Array.from(map[tag]).sort((a, b) => a.localeCompare(b));
    }
    return result;
  }, [items]);

  useEffect(() => {
    loadData();
  }, [sheetId, tabName, className, type]);

  const handleAddCustomTag = async (tag: string) => {
    if (!sheetId) return;
    try {
      await addMergedCustomTag(tag);
      setCustomDropdowns((prev) => ({
        ...prev,
        tags: [...new Set([...prev.tags, tag])],
      }));
    } catch (e) {
      console.error("Failed to add custom tag", e);
    }
  };

  const handleAddCustomType = async (tag: string, type: string) => {
    if (!sheetId) return;
    try {
      await addMergedCustomType(tag, type);
      setCustomDropdowns((prev) => {
        const existingTypes = prev.typesByTag[tag] || [];
        return {
          ...prev,
          typesByTag: {
            ...prev.typesByTag,
            [tag]: [...new Set([...existingTypes, type])],
          },
        };
      });
    } catch (e) {
      console.error("Failed to add custom type", e);
    }
  };

  const handleItemNameChange = (rowNumber: number, newName: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === rowNumber) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return { ...item, item: newName };
        }
        return item;
      }),
    );
  };

  const handleQuantityChange = (rowNumber: number, newQuantity: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === rowNumber) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return { ...item, quantity: newQuantity };
        }
        return item;
      }),
    );
  };

  const handleTypeChange = (rowNumber: number, newType: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === rowNumber) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return { ...item, type: newType };
        }
        return item;
      }),
    );
  };

  const handleTagChange = (rowNumber: number, newTag: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === rowNumber) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return { ...item, tag: newTag };
        }
        return item;
      }),
    );
  };

  const handleHostnameChange = (rowNumber: number, newHostname: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === rowNumber) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return { ...item, hostname: newHostname };
        }
        return item;
      }),
    );
  };

  const handleSnidChange = (rowNumber: number, newSnid: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === rowNumber) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return { ...item, snid: newSnid };
        }
        return item;
      }),
    );
  };

  const handleStatusToggle = (rowNumber: number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === rowNumber) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return {
            ...item,
            status: item.status === "Checked" ? "" : "Checked",
          };
        }
        return item;
      }),
    );
  };

  const handleDelete = (rowNumber: number) => {
    setItemToDelete(rowNumber);
  };

  const handleDuplicate = async (item: SheetRow) => {
    if (!sheetId || actualSheetNumericalId === null) return;
    if (duplicatingRows.has(item.row)) return;

    setDuplicatingRows((prev) => new Set(prev).add(item.row));

    const nextRow = item.row + 1;
    const duplicatedItem: SheetRow = {
      ...item,
      row: nextRow,
      lastUpdated: new Date().toLocaleString(),
    };

    setItems((prev) => {
      const idx = prev.findIndex((i) => i.row === item.row);
      const copy = [...prev];
      if (idx !== -1) {
        copy.splice(idx + 1, 0, duplicatedItem);
      } else {
        copy.push(duplicatedItem);
      }
      return copy;
    });

    try {
      await duplicateItemInClass(
        sheetId,
        actualSheetNumericalId,
        item,
        actualTabName,
      );
      formatClassColors(sheetId, actualSheetNumericalId, actualTabName).catch(
        () => {},
      );
      await loadData(false);
    } catch (err: any) {
      setError(err.message || "Failed to duplicate item");
      await loadData(false);
    } finally {
      setDuplicatingRows((prev) => {
        const next = new Set(prev);
        next.delete(item.row);
        return next;
      });
    }
  };

  const handleOpenMoveModal = async (item: SheetRow) => {
    setItemToMove(item);
    setMoveQty(item.quantity || "1");
    const defaultType = type === "class" ? "Classes" : "Stock Room";
    setMoveTargetType(defaultType);
    setMoveTargetName("");
    setCustomTargetName("");
    setIsFetchingDestinations(true);
    try {
      const meta = await getSpreadsheetMetadata(sheetId);
      const classesSheet = meta.sheets.find(
        (s) => ["class", "classes"].includes(s.properties.title.toLowerCase()),
      );
      const classesTab = classesSheet
        ? classesSheet.properties.title
        : "Classes";
      const classesList = await getClasses(sheetId, classesTab);

      const stockSheet = meta.sheets.find(
        (s) => s.properties.title.toLowerCase() === "stock room",
      );
      const stockTab = stockSheet ? stockSheet.properties.title : "Stock Room";
      const stockList = await getClasses(sheetId, stockTab);

      const cTitles = classesList.map((c) => c.title);
      const sTitles = stockList.map((s) => s.title);

      setAvailableClasses(cTitles);
      setAvailableStocks(sTitles);

      if (defaultType === "Classes") {
        const otherClasses = cTitles.filter((c) => c !== className);
        if (otherClasses.length > 0) {
          setMoveTargetName(otherClasses[0]);
        } else if (sTitles.length > 0) {
          setMoveTargetType("Stock Room");
          setMoveTargetName(sTitles[0]);
        }
      } else {
        const otherStocks = sTitles.filter((s) => s !== className);
        if (otherStocks.length > 0) {
          setMoveTargetName(otherStocks[0]);
        } else if (cTitles.length > 0) {
          setMoveTargetType("Classes");
          setMoveTargetName(cTitles[0]);
        }
      }
    } catch (err) {
      console.error("Failed to load move destinations:", err);
    } finally {
      setIsFetchingDestinations(false);
    }
  };

  const handleConfirmMove = async () => {
    if (!itemToMove || !sheetId || actualSheetNumericalId === null) return;
    const dest = customTargetName.trim() || moveTargetName.trim();
    if (!dest) {
      setError("Please select or enter a destination name.");
      return;
    }

    const movedRow = itemToMove.row;
    setIsMovingItem(true);

    // Optimistically update list
    setItems((prev) => prev.filter((i) => i.row !== movedRow));

    try {
      await moveItemToClassOrStock(
        sheetId,
        actualSheetNumericalId,
        actualTabName,
        className || "",
        itemToMove,
        moveTargetType,
        dest,
        moveQty,
      );
      setItemToMove(null);
      await loadData(false);
    } catch (err: any) {
      console.error(err);
      setError("Failed to move item: " + (err.message || err));
      await loadData(false);
    } finally {
      setIsMovingItem(false);
    }
  };

  const confirmDelete = () => {
    if (itemToDelete === null) return;
    setItems((prev) =>
      prev.map((item) => {
        if (item.row === itemToDelete) {
          setModifiedRows((prevMod) => new Set(prevMod).add(item.row));
          return {
            ...item,
            _isDeleted: true,
          };
        }
        return item;
      }),
    );
    setItemToDelete(null);
  };

  const cancelDelete = () => {
    setItemToDelete(null);
  };

  const handleSave = async (onlyRows?: number[]) => {
    if (saving || modifiedRows.size === 0 || (onlyRows && !onlyRows.some(row => modifiedRows.has(row)))) return;
    setSaving(true);
    setError(null);

    const allUpdates = items.filter((item) => modifiedRows.has(item.row) && (!onlyRows || onlyRows.includes(item.row)));
    const deletes = allUpdates.filter((item) => item._isDeleted);
    const updates = allUpdates.filter((item) => !item._isDeleted);

    try {
      if (updates.length > 0 && deletes.length === 0) {
        await updateClassInventory(sheetId, actualTabName, updates);
      }

      if (deletes.length > 0) {
        if (actualSheetNumericalId === null) throw new Error("Could not identify the sheet tab. Refresh and try again.");
        await deleteClassItems(
          sheetId,
          actualSheetNumericalId,
          actualTabName,
          deletes.map((d) => d.row),
          title || "",
          updates,
        );
        formatClassColors(
          sheetId,
          actualSheetNumericalId,
          actualTabName,
        ).catch(() => {});
      }
      setItems((prev) => prev.filter((item) => !deletes.some((d) => d.row === item.row)));
      setModifiedRows(current => new Set([...current].filter(row => !allUpdates.some(item => item.row === row))));
      setLastSavedAt(Date.now());
    } catch (err: any) {
      setError(err.message || "Failed to save updates.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLocationName.trim() || !sheetId) return;

    try {
      await addClassToInventory(sheetId, actualTabName, newLocationName.trim());
      if (actualSheetNumericalId !== null) {
        if (type === "stock") {
          await formatStockColors(
            sheetId,
            actualSheetNumericalId,
            actualTabName,
          ).catch(() => {});
        } else {
          await formatClassColors(
            sheetId,
            actualSheetNumericalId,
            actualTabName,
          ).catch(() => {});
        }
      }
    } catch (e) {
      console.error("Failed to create location block in Google Sheets:", e);
    }

    setIsAddingLocation(false);
    setNewLocationName("");
    loadData().catch(() => {});
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim() || !sheetId || actualSheetNumericalId === null)
      return;
    if (type === "class" && !className) return;

    setAddingStatus("saving");
    setError(null);

    // Optimistically create new SheetRow item
    const nextRow =
      (items.length > 0 ? Math.max(...items.map((i) => i.row)) : 1) + 1;
    const newItemObj: SheetRow = {
      row: nextRow,
      item: newItemName.trim(),
      quantity: newItemQuantity || "1",
      tag: newItemTag || "",
      type: newItemType || "",
      hostname: newItemHostname || "",
      snid: newItemSnid || "",
      location: newItemLocation || className || "",
      lastUpdated: new Date().toLocaleString(),
      status: "",
    };

    // Optimistically add to items state
    setItems((prev) => [...prev, newItemObj]);

    // Save values for backend API call
    const nameToAdd = newItemName.trim();
    const qtyToAdd = newItemQuantity;
    const tagToAdd = newItemTag;
    const typeToAdd = newItemType;
    const hostToAdd = newItemHostname;
    const snidToAdd = newItemSnid;
    const locToAdd = newItemLocation;

    // Reset UI state immediately
    setIsAddingItem(false);
    setNewItemName("");
    setNewItemType("");
    setNewItemQuantity("1");
    setNewItemSnid("");
    setNewItemTag("");
    setNewItemHostname("");
    setNewItemLocation("");
    setIsAddingItemInline(false);
    setAddingStatus("idle");

    try {
      const targetLocation = className || locToAdd;
      if (targetLocation) {
        let lastRow = items.length > 0 ? items[items.length - 1].row : null;

        if (lastRow === null) {
          lastRow = await getClassLastRow(
            sheetId,
            actualTabName,
            targetLocation,
          );
        }

        if (lastRow === null) {
          await addClassToInventory(sheetId, actualTabName, targetLocation);
          lastRow = await getClassLastRow(
            sheetId,
            actualTabName,
            targetLocation,
          );
        }

        if (lastRow !== null) {
          await addItemToClass(
            sheetId,
            actualSheetNumericalId,
            actualTabName,
            targetLocation,
            nameToAdd,
            lastRow,
            qtyToAdd,
            tagToAdd,
            typeToAdd,
            hostToAdd,
            snidToAdd,
          );
        } else {
          await appendInventoryItem(
            sheetId,
            actualTabName,
            nameToAdd,
            qtyToAdd,
            tagToAdd,
            typeToAdd,
            "",
            hostToAdd,
            snidToAdd,
            targetLocation,
          );
        }

        if (type === "stock") {
          formatStockColors(
            sheetId,
            actualSheetNumericalId,
            actualTabName,
          ).catch(() => {});
        } else {
          formatClassColors(
            sheetId,
            actualSheetNumericalId,
            actualTabName,
          ).catch(() => {});
        }
      } else {
        await appendInventoryItem(
          sheetId,
          actualTabName,
          nameToAdd,
          qtyToAdd,
          tagToAdd,
          typeToAdd,
          "",
          hostToAdd,
          snidToAdd,
          locToAdd,
        );
        if (type === "stock") {
          formatStockColors(
            sheetId,
            actualSheetNumericalId,
            actualTabName,
          ).catch(() => {});
        }
      }

      // Background silent data sync
      loadData().catch(() => {});
    } catch (err: any) {
      setError(err.message || "Failed to add item.");
    }
  };

  const handleAddGroupModel = async (event: React.FormEvent, group: ReturnType<typeof groupStockItems>[number]) => {
    event.preventDefault();
    const model = newGroupModel.trim();
    const quantity = Number(newGroupQuantity);
    if (!model || !Number.isInteger(quantity) || quantity < 0 || !sheetId || actualSheetNumericalId === null || addingStatus === 'saving' || saving || modifiedRows.size > 0) return;
    const location = className || group.rows[0]?.location || '';
    const category = group.rows[0]?.tag || '';
    setAddingStatus('saving');
    setError(null);
    try {
      if (location) {
        const lastRow = await getClassLastRow(sheetId, actualTabName, location);
        if (lastRow === null) throw new Error('Could not find this stock location. Refresh and try again.');
        await addItemToClass(sheetId, actualSheetNumericalId, actualTabName, location, group.name, lastRow, String(quantity), category, model, '', '');
      } else {
        await appendInventoryItem(sheetId, actualTabName, group.name, String(quantity), category, model, '', '', '', '');
      }
      if (isNewGroupModel && category) await handleAddCustomType(category, model);
      setNewGroupModel('');
      setIsNewGroupModel(false);
      setNewGroupQuantity('1');
      await loadData(false);
      formatStockColors(sheetId, actualSheetNumericalId, actualTabName).catch(() => {});
    } catch (err: any) {
      setError(err.message || `Could not add ${group.name} model.`);
    } finally {
      setAddingStatus('idle');
    }
  };

  const handleDeleteFullClass = async () => {
    if (!sheetId || actualSheetNumericalId === null) return;
    if ((type === "class" || type === "stock") && !className) return;

    setLoading(true);
    try {
      await deleteEntireClassOrLocation(
        sheetId,
        actualSheetNumericalId,
        actualTabName,
        className!,
      );

      if (type === "stock") {
        navigate("/stock-room");
      } else {
        navigate("/classes");
      }
    } catch (err: any) {
      setError(err.message || "Failed to delete.");
      setLoading(false);
    }
  };

  const filteredItems = items.filter((item) => {
    if (item._isDeleted) return false;
    if (showLowStockOnly && (parseInt(item.quantity, 10) || 0) > lowInventoryThreshold) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      item.item?.toLowerCase().includes(q) ||
      item.hostname?.toLowerCase().includes(q) ||
      item.snid?.toLowerCase().includes(q) ||
      item.tag?.toLowerCase().includes(q) ||
      item.type?.toLowerCase().includes(q)
    );
  }).sort((a, b) => {
    if (sortBy === "quantity-low") return (parseInt(a.quantity, 10) || 0) - (parseInt(b.quantity, 10) || 0) || a.item.localeCompare(b.item);
    if (sortBy === "quantity-high") return (parseInt(b.quantity, 10) || 0) - (parseInt(a.quantity, 10) || 0) || a.item.localeCompare(b.item);
    if (sortBy === "name") return a.item.localeCompare(b.item);
    return 0;
  });
  const totalVisibleItems = items.filter((item) => !item._isDeleted).length;

  const groupedItems = { All: filteredItems };
  const visibleStockGroups = groupStockItems(filteredItems);
  const selectedStockGroup = groupStockItems(items).find(group => group.key === selectedStockGroupKey);

  const pieData = React.useMemo(() => {
    if (type !== "stock") return [];

    // Instead of using filteredItems, we will just use `items` for the chart
    // so it doesn't jump around while searching, or maybe use filtered?
    // Let's use `items` without search query so it's a global view.
    const groups: Record<string, number> = {};
    items.forEach((item) => {
      if (item._isDeleted) return;
      const groupKey = item.tag?.trim() || "Uncategorized";
      const q = parseInt(item.quantity) || 1;
      if (!groups[groupKey]) groups[groupKey] = 0;
      groups[groupKey] += q;
    });

    return Object.entries(groups)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [items, type]);

  const PIE_COLORS = [
    "#6366f1", // indigo-500
    "#3b82f6", // blue-500
    "#10b981", // emerald-500
    "#f43f5e", // rose-500
    "#f59e0b", // amber-500
    "#a855f7", // purple-500
    "#06b6d4", // cyan-500
    "#8b5cf6", // violet-500
    "#ec4899", // pink-500
  ];

  const handleRenameGroup = (oldGroup: string) => {
    const newName = editingGroupName.trim();
    if (!newName || newName === oldGroup) {
      setEditingGroup(null);
      return;
    }

    setItems((prev) => {
      const newItems = prev.map((item) => {
        const currentGroupKey = item.tag?.trim() || "Uncategorized";
        if (currentGroupKey === oldGroup) {
          setModifiedRows((mod) => new Set(mod).add(item.row));
          return {
            ...item,
            tag: newName,
          };
        }
        return item;
      });
      return newItems;
    });
    setEditingGroup(null);
  };

  const renderItemCard = (item: SheetRow, idx: number) => {
    const ItemIcon = getItemIcon(
      item.item || "",
      item.tag || "",
      item.type || "",
    );
    return (
      <div
        key={`${item.row}-${idx}`}
        className={cn(
          "inventory-item-card flex flex-col gap-3 py-4 px-2 sm:px-4 transition-colors rounded-xl",
          item.status === "Checked"
            ? "bg-blue-50/80 dark:bg-blue-900/10 hover:bg-blue-100/60 dark:hover:bg-blue-900/20"
            : "hover:bg-slate-50 dark:hover:bg-slate-700/30",
        )}
      >
        <div className="inventory-item-main flex justify-between items-start">
          <div className="inventory-item-fields flex flex-col flex-1 mr-4 space-y-1.5">
            <div className="inventory-item-title flex items-center gap-2">
              {type === "class" && (
                <button
                  onClick={() => handleStatusToggle(item.row)}
                  className={cn(
                    "p-1.5 rounded-lg transition-colors shrink-0",
                    item.status === "Checked"
                      ? "bg-blue-500 text-white hover:bg-blue-600 shadow-sm"
                      : "bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400",
                  )}
                  title="Mark as double checked"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center justify-center p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 text-indigo-500 dark:text-indigo-400 shrink-0">
                <ItemIcon className="w-4 h-4" />
              </div>
              <DebouncedInput
                type="text"
                aria-label={`Item name for ${item.item || "unnamed item"}`}
                value={item.item}
                onChange={(val) => handleItemNameChange(item.row, val)}
                className={cn(
                  "min-w-0 text-sm font-semibold bg-transparent border-none outline-none focus:ring-1 focus:ring-indigo-300 dark:focus:ring-indigo-500 rounded px-1 -ml-1 w-full",
                  item.status === "Checked"
                    ? "text-blue-900 dark:text-blue-300"
                    : "text-slate-900 dark:text-slate-100",
                  modifiedRows.has(item.row) &&
                    "text-indigo-900 dark:text-indigo-300",
                )}
              />
              {type === "stock" && (parseInt(item.quantity) || 0) <= lowInventoryThreshold && (
                <div
                  className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 shrink-0 border border-rose-200 dark:border-rose-500/30 whitespace-nowrap"
                  title={`Low inventory (threshold: ${lowInventoryThreshold})`}
                >
                  <AlertCircle className="w-3 h-3" />
                  Low
                </div>
              )}
              {modifiedRows.has(item.row) && (
                <span className="shrink-0 rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                  Unsaved
                </span>
              )}
            </div>
            <div className="inventory-item-summary">{item.type || t('No model')} · {t('Qty')} {item.quantity}{item.status === 'Checked' ? ` · ${t('Checked')}` : ''}</div>
            <>
              <div className="inventory-item-field"><span className="inventory-item-field-label">Category</span>
              <TagInput
                value={item.tag || ""}
                onChange={(val) => handleTagChange(item.row, val)}
                isActive={modifiedRows.has(item.row)}
                existingTags={existingTags}
                customTags={customDropdowns.tags}
                onAddCustom={handleAddCustomTag}
              />
              </div>
              <div className="inventory-item-field"><span className="inventory-item-field-label">Type / model</span>
              <TypeInput
                value={item.type || ""}
                tagValue={(item.tag || "Other").trim()}
                onChange={(val) => handleTypeChange(item.row, val)}
                isActive={modifiedRows.has(item.row)}
                existingTypes={
                  existingTypesByTag[(item.tag || "Other").trim()] || []
                }
                customTypes={
                  customDropdowns.typesByTag[(item.tag || "Other").trim()] || []
                }
                onAddCustom={handleAddCustomType}
              />
              </div>
            </>
            {item.tag === "Computer" && (
              <div className="inventory-item-extra flex flex-col gap-2 w-full max-w-[200px]">
                <DebouncedInput
                  type="text"
                  placeholder="Hostname"
                  value={item.hostname || ""}
                  onChange={(val) => handleHostnameChange(item.row, val)}
                  className={cn(
                    "w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-all border placeholder:text-slate-400 dark:placeholder:text-slate-500",
                    modifiedRows.has(item.row)
                      ? "border-indigo-300 bg-indigo-50/50 text-indigo-900 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
                      : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:border-indigo-400 dark:focus:border-indigo-500",
                  )}
                />
                <div className="relative w-full flex items-center">
                  <DebouncedInput
                    type="text"
                    placeholder="SNID (Scan)"
                    value={item.snid || ""}
                    onChange={(val) => handleSnidChange(item.row, val)}
                    className={cn(
                      "w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg outline-none transition-all border placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      modifiedRows.has(item.row)
                        ? "border-indigo-300 bg-indigo-50/50 text-indigo-900 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:border-indigo-400 dark:focus:border-indigo-500",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpenIdx(item.row)}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
                    title="Scan Barcode"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
            {(item.tag === "TV" || item.tag === "Interactive") && (
              <div className="inventory-item-extra flex flex-col gap-2 w-full max-w-[200px]">
                {(item.tag === "Interactive" ||
                  item.type?.toLowerCase().includes("interactive")) && (
                  <SearchableSelect
                    aria-label="Enrollment"
                    value={item.hostname || ""}
                    onChange={(nextValue) => handleHostnameChange(item.row, nextValue)}
                    className={cn(
                      "w-full text-xs px-2.5 py-1.5 rounded-lg outline-none transition-all border cursor-pointer",
                      modifiedRows.has(item.row)
                        ? "border-indigo-300 bg-indigo-50/50 text-indigo-900 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:border-indigo-400 dark:focus:border-indigo-500",
                    )}
                    placeholder="Enrollment"
                    options={[{ value: '', label: '-- Enrollment --' }, { value: 'Enroll', label: 'Enroll' }, { value: 'Unenroll', label: 'Unenroll' }]}
                  />
                )}
                <div className="relative w-full flex items-center">
                  <DebouncedInput
                    type="text"
                    placeholder="SNID (Scan)"
                    value={item.snid || ""}
                    onChange={(val) => handleSnidChange(item.row, val)}
                    className={cn(
                      "w-full text-xs pl-8 pr-2.5 py-1.5 rounded-lg outline-none transition-all border placeholder:text-slate-400 dark:placeholder:text-slate-500",
                      modifiedRows.has(item.row)
                        ? "border-indigo-300 bg-indigo-50/50 text-indigo-900 dark:bg-indigo-500/20 dark:border-indigo-500/30 dark:text-indigo-300"
                        : "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-700 dark:text-slate-200 focus:border-indigo-400 dark:focus:border-indigo-500",
                    )}
                  />
                  <button
                    type="button"
                    onClick={() => setScannerOpenIdx(item.row)}
                    className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-md transition-colors"
                    title="Scan Barcode"
                  >
                    <ScanLine className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="inventory-item-controls flex flex-col items-end gap-2 shrink-0">
            <div className="inventory-item-tools flex items-center gap-1">
              <button
                onClick={() => handleDuplicate(item)}
                disabled={duplicatingRows.has(item.row)}
                className={cn(
                  "min-h-10 min-w-10 rounded-lg transition-colors flex items-center justify-center",
                  duplicatingRows.has(item.row)
                    ? "opacity-40 cursor-not-allowed text-slate-400"
                    : "text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-500/10",
                )}
                title="Duplicate item"
                aria-label={`Duplicate ${item.item}`}
              >
                <Copy
                  className={cn(
                    "w-4 h-4",
                    duplicatingRows.has(item.row) && "animate-pulse",
                  )}
                />
              </button>
              <button
                onClick={() => handleOpenMoveModal(item)}
                className="min-h-10 min-w-10 flex items-center justify-center text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10 rounded-lg transition-colors"
                title="Move item to another Class or Stock"
                aria-label={`Move ${item.item} to another location`}
              >
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(item.row)}
                className="min-h-10 min-w-10 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                title="Remove item"
                aria-label={`Remove ${item.item}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <div className="inventory-item-quantity flex items-center gap-2 sm:gap-4 mt-1">
              <button
                onClick={() => {
                  const val = parseInt(item.quantity) || 0;
                  if (val > 0) handleQuantityChange(item.row, String(val - 1));
                }}
                aria-label={`Decrease quantity of ${item.item}`}
                disabled={(parseInt(item.quantity, 10) || 0) <= 0}
                className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                -
              </button>
              <DebouncedInput
                type="text"
                inputMode="numeric"
                aria-label={`Quantity of ${item.item}`}
                value={item.quantity}
                onChange={(val) => handleQuantityChange(item.row, val)}
                className={cn(
                  "w-12 text-center font-bold outline-none bg-transparent text-lg",
                  modifiedRows.has(item.row)
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-slate-900 dark:text-slate-100",
                )}
              />
              <button
                onClick={() => {
                  const val = parseInt(item.quantity) || 0;
                  handleQuantityChange(item.row, String(val + 1));
                }}
                aria-label={`Increase quantity of ${item.item}`}
                className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold cursor-pointer hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
              >
                +
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500 dark:text-slate-400 gap-3">
        <FluidSpinner size="md" />
        <p>Loading inventory...</p>
      </div>
    );
  }

  return (
    <div className={cn("relative", type === "class" ? "class-detail-inventory" : "space-y-6 pb-12")} aria-busy={saving}>
      <AnimatePresence>
        {(saving || addingStatus === "saving") && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 rounded-full shadow-xl shadow-slate-900/20 dark:shadow-white/20 backdrop-blur-md border border-slate-700/50 dark:border-slate-200/50"
          >
            <div className="relative flex items-center justify-center w-5 h-5">
              <Cloud className="w-5 h-5 text-slate-400 dark:text-slate-500 absolute" />
              <RefreshCw className="w-3 h-3 text-indigo-400 dark:text-indigo-600 absolute animate-spin bg-slate-900 dark:bg-white rounded-full" />
            </div>
            <span className="text-sm font-semibold tracking-wide">
              Syncing with Sheets...
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            {title}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 font-medium mt-1">
            {subtitle}{" "}
            {actualTabName ? (
              <span className="text-indigo-600 dark:text-indigo-400">
                ({actualTabName})
              </span>
            ) : (
              ""
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDraftReport(true)}
            className="px-4 py-2.5 rounded-full text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm text-sm flex items-center gap-2"
            title="Draft Report"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">Draft Report</span>
          </button>

          {(type === "class" || type === "stock") && (
            <button
              onClick={() => setShowDeleteClassConfirm(true)}
              className="px-4 py-2.5 rounded-full text-red-600 dark:text-red-400 font-bold hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm text-sm"
              title={type === "class" ? "Delete Class" : "Delete Stock"}
            >
              Delete
            </button>
          )}
          {sheetId && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 rounded-full text-indigo-600 dark:text-indigo-400 font-bold hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm text-sm"
            >
              Open in Sheets
            </a>
          )}
          <button
            onClick={loadData}
            className="p-2.5 rounded-full text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-white/40 dark:border-white/10 shadow-sm"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-500/20 flex gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {!error && modifiedRows.size === 0 && lastSavedAt && <p role="status" className="text-sm font-semibold text-sky-800 dark:text-sky-200">{t('Saved to Google Sheets')}</p>}

      {type !== "class" && modifiedRows.size > 0 && (
        <div role="status" className="inventory-unsaved-banner sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/95 px-4 py-3 shadow-lg backdrop-blur-md dark:border-indigo-500/30 dark:bg-slate-900/95">
          <div className="flex items-center gap-2 text-sm font-semibold text-indigo-900 dark:text-indigo-100">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {modifiedRows.size} unsaved {modifiedRows.size === 1 ? "item" : "items"}
          </div>
          <button
            type="button"
            onClick={() => handleSave()}
            disabled={saving}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : "Submit to Sheets"}
          </button>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              aria-label="Search inventory items"
              placeholder="Search item, serial number, hostname, tag, or type..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setVisibleLimit(30); setSelectedStockGroupKey(null); }}
              onKeyDown={(e) => { if (e.key === "Escape") setSearchQuery(""); }}
              className="w-full pl-12 pr-12 py-3 bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} aria-label="Clear search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <p role="status" className="px-1 text-sm text-slate-500 dark:text-slate-400">
            {searchQuery.trim() || showLowStockOnly ? `${filteredItems.length} of ${totalVisibleItems} items shown` : `${totalVisibleItems} ${totalVisibleItems === 1 ? "item" : "items"}`}
          </p>
          <div className="flex flex-wrap items-center gap-2 px-1">
            <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-300">
              Sort by
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100">
                <option value="sheet">Sheet order</option>
                <option value="name">Item name</option>
                <option value="quantity-low">Quantity: low first</option>
                <option value="quantity-high">Quantity: high first</option>
              </select>
            </label>
            <label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <input type="checkbox" checked={showLowStockOnly} onChange={(e) => setShowLowStockOnly(e.target.checked)} className="h-4 w-4 accent-indigo-600" />
              Low stock (≤ {lowInventoryThreshold})
            </label>
          </div>
        </div>
      )}

      {items.length === 0 && !error ? (
        <div inert={saving} className={cn("bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] shadow-sm overflow-hidden p-2 sm:p-5", type === "class" && "inventory-items-panel")}>
          <div className="text-center py-12 border border-slate-200 dark:border-slate-700 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/50 mb-4">
            <Package className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
            <h3 className="text-slate-700 dark:text-slate-300 font-medium">
              No items found
            </h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
              Click 'Add Item' below to start tracking inventory.
            </p>
          </div>

          <div className="inventory-items-add mt-4 pt-4 border-t border-slate-100 px-2 sm:px-4">
            {!isAddingItem ? (
              <button
                onClick={() => setIsAddingItem(true)}
                className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2.5 rounded-xl transition-colors w-full justify-center border border-dashed border-indigo-200"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            ) : (
              <form
                onSubmit={handleAddItem}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full"
              >
                <div className="relative flex-1 min-w-[180px]">
                  <input
                    list="master-items-list"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full text-sm px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white/60 dark:bg-slate-800/60 text-slate-900 dark:text-slate-100 focus:border-purple-400 outline-none transition-all placeholder:text-slate-400"
                    placeholder="Search or select from Master List..."
                    required
                  />
                  <datalist id="master-items-list">
                    {masterItems.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                {type === "stock" && (
                  <div className="relative w-full sm:w-32">
                    <SearchableSelect
                      aria-label="Stock room location"
                      value={newItemLocation}
                      onChange={setNewItemLocation}
                      className="w-full text-sm font-semibold px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      placeholder="No Location"
                      searchPlaceholder="Search locations..."
                      options={[{ value: '', label: 'No Location' }, ...Object.keys(groupedItems)
                        .filter((k) => k !== "All" && k !== "Uncategorized")
                        .map((loc) => ({ value: loc, label: loc }))]}
                    />
                  </div>
                )}
                <div className="relative w-full sm:w-32">
                  <SearchableSelect
                    aria-label="Category"
                    value={newItemTag}
                    onChange={setNewItemTag}
                    className="w-full text-sm font-semibold px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="Category"
                    searchPlaceholder="Search categories..."
                    options={[{ value: '', label: 'Category' }, ...Array.from(
                      new Set(
                        [
                          "Computer",
                          "Peripheral",
                          "Accessory",
                          "Cable",
                          "TV",
                          "Interactive",
                          "Other",
                          ...existingTags,
                          ...(customDropdowns.tags || []),
                        ].filter(Boolean),
                      ),
                    ).map((cat) => ({ value: cat, label: cat }))]}
                  />
                </div>
                <div className="relative w-full sm:w-32">
                  <input
                    type="text"
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value)}
                    className="w-full text-sm font-semibold px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="Type/Model"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingStatus === "saving" || !newItemName.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {addingStatus === "saving" ? "..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setNewItemName("");
                  }}
                  className="px-4 py-3 sm:py-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center"
                  title="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
            )}
          </div>
        </div>
      ) : (
        <div inert={saving} className={cn("bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] shadow-sm overflow-hidden p-2 sm:p-5", type === "class" && "inventory-items-panel")}>
          {filteredItems.length === 0 ? (
            <div className="text-center py-12 border border-slate-200 dark:border-slate-700 border-dashed rounded-xl bg-slate-50 dark:bg-slate-900/50 mb-4">
              <Search className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
              <h3 className="text-slate-700 dark:text-slate-300 font-medium">
                No items match your filters
              </h3>
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Try a different search or turn off the low-stock filter.
              </p>
              <button type="button" onClick={() => { setSearchQuery(""); setShowLowStockOnly(false); }} className="mt-4 rounded-xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:text-indigo-300 dark:hover:bg-indigo-500/20">
                Clear filters
              </button>
            </div>
          ) : (
            type === "stock" ? (
              <div>
                <div className="stock-item-grid" aria-label="Item groups in stock room">
                  {(isPhone ? visibleStockGroups.slice(0, visibleLimit) : visibleStockGroups).map(group => {
                    const first = group.rows[0];
                    const ItemIcon = getItemIcon(group.name, first.tag || '', first.type || '');
                    const isSelected = selectedStockGroupKey === group.key;
                    return <button
                      type="button"
                      key={group.key}
                      className={`stock-item-tile ${isSelected ? 'stock-item-tile-active' : ''} ${group.totalQuantity <= lowInventoryThreshold ? 'stock-item-tile-low' : ''}`}
                      onClick={() => { setSelectedStockGroupKey(isSelected ? null : group.key); setIsAddingItem(false); setNewGroupModel(''); setIsNewGroupModel(false); setNewGroupQuantity('1'); }}
                      aria-expanded={isSelected}
                      aria-controls={isSelected ? 'stock-item-group-details' : undefined}
                      aria-label={`${group.name}: ${group.rows.length} ${group.rows.length === 1 ? 'entry' : 'entries'}, ${group.modelCount} ${group.modelCount === 1 ? 'model' : 'models'}, total quantity ${group.totalQuantity}. ${isSelected ? 'Close' : 'View'} items`}
                    >
                      <span className="stock-item-tile-icon"><ItemIcon size={27} strokeWidth={1.5} /></span>
                      <strong>{group.name}</strong>
                      <span>{group.rows.length} {group.rows.length === 1 ? 'entry' : 'entries'} · {group.modelCount} {group.modelCount === 1 ? 'model' : 'models'}</span>
                      <b>Qty {group.totalQuantity}</b>
                    </button>;
                  })}
                </div>
                {isPhone && visibleStockGroups.length > visibleLimit && <button type="button" onClick={() => setVisibleLimit(limit => limit + 30)} className="mt-3 min-h-12 w-full rounded-xl border border-sky-400 bg-sky-50 font-bold text-sky-900 dark:bg-sky-950 dark:text-sky-100">{t('Show more items')} ({visibleStockGroups.length - visibleLimit} {t('left')})</button>}
                {selectedStockGroup && <section id="stock-item-group-details" className="stock-item-group-details" aria-label={`${selectedStockGroup.name} models and items`}>
                  <div className="stock-item-group-heading"><div><span>STOCK ITEM</span><h3>{selectedStockGroup.name}</h3><p>{selectedStockGroup.rows.length} {selectedStockGroup.rows.length === 1 ? 'entry' : 'entries'} · {selectedStockGroup.modelCount} {selectedStockGroup.modelCount === 1 ? 'model' : 'models'} · Qty {selectedStockGroup.totalQuantity}</p></div><button type="button" onClick={() => setSelectedStockGroupKey(null)} aria-label={`Close ${selectedStockGroup.name} details`}><X size={18} /></button></div>
                  <div className="stock-item-group-rows">{selectedStockGroup.rows.map((item, idx) => renderItemCard(item, idx))}</div>
                  <button type="button" onClick={() => handleSave(selectedStockGroup.rows.map(item => item.row))} disabled={saving || !selectedStockGroup.rows.some(item => modifiedRows.has(item.row))} className="stock-item-group-save">{saving ? 'Saving…' : `Save ${selectedStockGroup.name} changes to Sheets`}</button>
                  <form className="stock-item-group-add" onSubmit={event => handleAddGroupModel(event, selectedStockGroup)}>
                    <strong>Add {selectedStockGroup.name} model</strong>
                    <p>Item: {selectedStockGroup.name} · Category: {selectedStockGroup.rows[0]?.tag || 'Uncategorized'}{className ? ` · Location: ${className}` : ''}</p>
                    <div className="stock-item-group-add-fields"><div className="stock-item-group-model"><span>Type / model</span>{isNewGroupModel ? <div className="stock-item-group-custom-model"><input autoFocus aria-label={`New ${selectedStockGroup.name} model`} value={newGroupModel} onChange={event => setNewGroupModel(event.target.value)} maxLength={120} placeholder="New model name" required /><button type="button" onClick={() => { setIsNewGroupModel(false); setNewGroupModel(''); }} aria-label="Choose an existing model" title="Choose existing model"><ChevronDown size={16} /></button></div> : <SearchableSelect aria-label={`${selectedStockGroup.name} model`} value={newGroupModel} onChange={value => { if (value === '__NEW_MODEL__') { setIsNewGroupModel(true); setNewGroupModel(''); } else setNewGroupModel(value); }} className="stock-item-group-model-select" placeholder="Choose type from Types" searchPlaceholder="Search types..." options={[...stockModelChoices(selectedStockGroup, customDropdowns.typesByTag).map(model => ({ value: model, label: model })), { value: '__NEW_MODEL__', label: '+ New model...' }]} />}</div><label>Quantity<input type="number" min="0" step="1" value={newGroupQuantity} onChange={event => setNewGroupQuantity(event.target.value)} required /></label><button type="submit" disabled={addingStatus === 'saving' || saving || modifiedRows.size > 0 || !newGroupModel.trim()}><Plus size={16} />{addingStatus === 'saving' ? 'Adding…' : 'Add model'}</button></div>
                    {modifiedRows.size > 0 && <p>Save your pending changes before adding another model.</p>}
                  </form>
                </section>}
              </div>
            ) : (
              <div className="inventory-item-list inventory-items-scroll divide-y divide-slate-100 dark:divide-slate-700/50 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white/60 dark:bg-slate-800/60" aria-label="Inventory items">
                {(isPhone ? filteredItems.slice(0, visibleLimit) : filteredItems).map((item, idx) => renderItemCard(item, idx))}
              </div>
            )
          )}
          {type !== 'stock' && isPhone && filteredItems.length > visibleLimit && <button type="button" onClick={() => setVisibleLimit(limit => limit + 30)} className="mt-3 min-h-12 w-full rounded-xl border border-sky-400 bg-sky-50 font-bold text-sky-900 dark:bg-sky-950 dark:text-sky-100">{t('Show more items')} ({filteredItems.length - visibleLimit} {t('left')})</button>}

          {(type !== 'stock' || !selectedStockGroup) && <div className="inventory-items-add mt-4 pt-4 border-t border-slate-100 px-2 sm:px-4">
            {!isAddingItem ? (
              <button
                onClick={() => setIsAddingItem(true)}
                className="flex items-center gap-2 text-indigo-600 font-bold hover:bg-indigo-50 px-4 py-2.5 rounded-xl transition-colors w-full justify-center border border-dashed border-indigo-200"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            ) : (
              <form
                onSubmit={handleAddItem}
                className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full"
              >
                <div className="relative flex-1 min-w-[180px]">
                  <input
                    list="master-items-list"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="w-full text-sm font-semibold px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 dark:bg-slate-800 dark:border-slate-700 dark:text-white focus:border-indigo-500 outline-none transition-all"
                    placeholder="Search or select from Master List..."
                    required
                  />
                  <datalist id="master-items-list">
                    {masterItems.map((m) => (
                      <option key={m} value={m} />
                    ))}
                  </datalist>
                </div>
                {type === "stock" && (
                  <div className="relative w-full sm:w-32">
                    <SearchableSelect
                      aria-label="Stock room location"
                      value={newItemLocation}
                      onChange={setNewItemLocation}
                      className="w-full text-sm font-semibold px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                      placeholder="No Location"
                      searchPlaceholder="Search locations..."
                      options={[{ value: '', label: 'No Location' }, ...Object.keys(groupedItems)
                        .filter((k) => k !== "All" && k !== "Uncategorized")
                        .map((loc) => ({ value: loc, label: loc }))]}
                    />
                  </div>
                )}
                <div className="relative w-full sm:w-32">
                  <SearchableSelect
                    aria-label="Category"
                    value={newItemTag}
                    onChange={setNewItemTag}
                    className="w-full text-sm font-semibold px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="Category"
                    searchPlaceholder="Search categories..."
                    options={[{ value: '', label: 'Category' }, ...Array.from(
                      new Set(
                        [
                          "Computer",
                          "Peripheral",
                          "Accessory",
                          "Cable",
                          "TV",
                          "Interactive",
                          "Other",
                          ...existingTags,
                          ...(customDropdowns.tags || []),
                        ].filter(Boolean),
                      ),
                    ).map((cat) => ({ value: cat, label: cat }))]}
                  />
                </div>
                <div className="relative w-full sm:w-32">
                  <input
                    type="text"
                    value={newItemType}
                    onChange={(e) => setNewItemType(e.target.value)}
                    className="w-full text-sm font-semibold px-3 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:border-indigo-500 outline-none transition-all dark:bg-slate-800 dark:border-slate-700 dark:text-white"
                    placeholder="Type/Model"
                  />
                </div>
                <button
                  type="submit"
                  disabled={addingStatus === "saving" || !newItemName.trim()}
                  className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors disabled:opacity-50"
                >
                  {addingStatus === "saving" ? "..." : "Add"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setNewItemName("");
                  }}
                  className="px-4 py-3 sm:py-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors flex items-center justify-center"
                  title="Cancel"
                >
                  <X className="w-5 h-5" />
                </button>
              </form>
            )}
          </div>}

          {type !== 'stock' && <button
            onClick={() => handleSave()}
            disabled={saving || modifiedRows.size === 0}
            className={cn(
              "inventory-items-submit w-full font-bold py-4 rounded-2xl shadow-lg mt-6 transition-all",
              modifiedRows.size > 0
                ? "bg-indigo-600 text-white shadow-indigo-200 dark:shadow-indigo-900/20 hover:bg-indigo-700 hover:shadow-indigo-300 dark:hover:shadow-indigo-900/40"
                : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none",
            )}
          >
            {saving ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white/80 border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </div>
            ) : (
              <span>
                Submit to Sheets{" "}
                {modifiedRows.size > 0 ? `(${modifiedRows.size})` : ""}
              </span>
            )}
          </button>}
        </div>
      )}

      {itemToDelete !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-2">
                <AlertCircle className="w-6 h-6" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  Remove Item
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-6 mt-2 text-sm">
                Are you sure you want to remove this item from the list? (Click
                "Submit to Sheets" afterwards to save changes).
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={cancelDelete}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="px-4 py-2 font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm shadow-red-200 dark:shadow-none text-sm"
                >
                  Remove Item
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDeleteClassConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10 max-w-sm w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="p-6">
              <div className="flex items-center gap-3 text-red-600 dark:text-red-400 mb-2">
                <AlertCircle className="w-6 h-6" />
                <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                  {type === "class" ? "Delete Class" : "Delete Stock"}
                </h3>
              </div>
              <p className="text-slate-600 dark:text-slate-300 mb-6 mt-2">
                Are you sure you want to delete the{" "}
                {type === "class" ? "class" : "stock"}{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">
                  "{className}"
                </span>
                ? This will remove all items in this{" "}
                {type === "class" ? "class" : "stock"} immediately.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteClassConfirm(false)}
                  className="px-4 py-2 font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowDeleteClassConfirm(false);
                    handleDeleteFullClass();
                  }}
                  className="px-4 py-2 font-bold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors shadow-sm shadow-red-200 dark:shadow-none"
                >
                  {type === "class" ? "Delete Class" : "Delete Stock"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {itemToMove !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl rounded-[32px] shadow-2xl border border-white/60 dark:border-white/10 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
                  <ArrowRight className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                    Move Item
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Moving{" "}
                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                      "{itemToMove.item}"
                    </span>{" "}
                    from {className}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setItemToMove(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isFetchingDestinations ? (
              <div className="py-8 flex flex-col items-center justify-center gap-2 text-slate-500 text-sm">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                Loading destinations...
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Move To Category
                  </label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-2xl">
                    <button
                      type="button"
                      onClick={() => {
                        setMoveTargetType("Classes");
                        const otherClasses = availableClasses.filter(
                          (c) => c !== className,
                        );
                        setMoveTargetName(otherClasses[0] || "");
                        setCustomTargetName("");
                      }}
                      className={cn(
                        "py-2 px-3 rounded-xl text-sm font-bold transition-all",
                        moveTargetType === "Classes"
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                      )}
                    >
                      Classes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMoveTargetType("Stock Room");
                        const otherStocks = availableStocks.filter(
                          (s) => s !== className,
                        );
                        setMoveTargetName(otherStocks[0] || "");
                        setCustomTargetName("");
                      }}
                      className={cn(
                        "py-2 px-3 rounded-xl text-sm font-bold transition-all",
                        moveTargetType === "Stock Room"
                          ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200",
                      )}
                    >
                      Stock Room
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
                    Select Destination{" "}
                    {moveTargetType === "Classes" ? "Class" : "Stock"}
                  </label>
                  {(moveTargetType === "Classes"
                    ? availableClasses
                    : availableStocks
                  ).length > 0 ? (
                    <SearchableSelect
                      aria-label="Destination"
                      value={moveTargetName}
                      onChange={(nextValue) => {
                        setMoveTargetName(nextValue);
                        setCustomTargetName("");
                      }}
                      className="w-full px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-medium text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                      placeholder="Choose destination"
                      searchPlaceholder="Search destinations..."
                      options={(moveTargetType === "Classes"
                        ? availableClasses
                        : availableStocks
                      ).map((target) => ({ value: target, label: `${target}${target === className ? ' (Current)' : ''}`, disabled: target === className }))}
                    />
                  ) : (
                    <p className="text-xs text-slate-400 italic mb-1">
                      No existing{" "}
                      {moveTargetType === "Classes" ? "classes" : "stocks"}{" "}
                      found. Enter a name below.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Or enter a new{" "}
                    {moveTargetType === "Classes" ? "Class" : "Stock"} name:
                  </label>
                  <input
                    type="text"
                    placeholder={`e.g. ${moveTargetType === "Classes" ? "Class 3C" : "Lab 102 Stock"}`}
                    value={customTargetName}
                    onChange={(e) => setCustomTargetName(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Quantity to Move
                    </label>
                    <span className="text-xs text-slate-400">
                      Current Qty: {itemToMove.quantity || "1"}
                    </span>
                  </div>
                  <input
                    type="number"
                    min="1"
                    max={parseInt(itemToMove.quantity) || 1}
                    value={moveQty}
                    onChange={(e) => setMoveQty(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 font-bold text-sm outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setItemToMove(null)}
                    disabled={isMovingItem}
                    className="px-4 py-2.5 rounded-xl font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmMove}
                    disabled={
                      isMovingItem ||
                      (!moveTargetName && !customTargetName.trim())
                    }
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl transition-all shadow-md shadow-indigo-200 dark:shadow-none flex items-center gap-2"
                  >
                    {isMovingItem ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Moving...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-4 h-4" />
                        Move Item
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDraftReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm print:bg-white print:backdrop-blur-none">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700 print:shadow-none print:border-none print:h-auto print:max-h-none">
            <div className="flex items-center justify-between p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 print:hidden">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                    Draft Report
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {title}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    let totalItems = 0;
                    const filteredData = Object.entries(groupedItems)
                      .map(([group, groupItems]) => {
                        const activeItems = (groupItems as SheetRow[]).filter(
                          (i) => {
                            if (i._isDeleted) return false;
                            let matchesItem = true;
                            let matchesType = true;
                            if (draftReportItemQuery.trim()) {
                              const query = draftReportItemQuery.toLowerCase();
                              matchesItem =
                                (i.item || "").toLowerCase().includes(query) ||
                                (i.hostname || "")
                                  .toLowerCase()
                                  .includes(query) ||
                                (i.snid || "").toLowerCase().includes(query);
                            }
                            if (draftReportTypeQuery.trim()) {
                              const query = draftReportTypeQuery.toLowerCase();
                              matchesType =
                                (i.type || "").toLowerCase().includes(query) ||
                                (i.tag || "").toLowerCase().includes(query);
                            }
                            return matchesItem && matchesType;
                          },
                        );

                        activeItems.forEach((item) => {
                          totalItems += parseInt(item.quantity) || 0;
                        });

                        return { group, activeItems };
                      })
                      .filter((g) => g.activeItems.length > 0);

                    const itemNameFilter = draftReportItemQuery
                      ? draftReportItemQuery
                      : "items";
                    let message = `Hi [Boss's Name],

I just reviewed the latest classroom equipment inventory for ${title} ${actualTabName ? `(${actualTabName})` : ""}. We currently have a total of ${totalItems} ${itemNameFilter}.

Here is the breakdown by category:

`;

                    filteredData.forEach((g) => {
                      message += `${g.group}:
`;
                      g.activeItems.forEach((item) => {
                        const typeTag = item.type || item.tag || "";
                        let itemDetail = `- ${item.quantity} ${typeTag ? typeTag + " " : ""}${item.item}`;

                        if (type === "stock" && (parseInt(item.quantity) || 0) <= lowInventoryThreshold) {
                          itemDetail += " [LOW]";
                        }

                        const extras = [];
                        if (item.snid) extras.push(`SN: ${item.snid}`);
                        if (item.hostname)
                          extras.push(`Hostname: ${item.hostname}`);

                        if (extras.length > 0) {
                          itemDetail += ` (${extras.join(" and ")})`;
                        }
                        message += `${itemDetail}
`;
                      });
                      message += "\\n";
                    });
                    message +=
                      "Please let me know if you need the full stock report for the rest of the IT equipment.\n\nBest regards,\n[Your Name]\nIT Support";
                    setTextReportContent(message);
                    setShowTextReport(true);
                  }}
                  className="p-2 sm:px-4 sm:py-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 font-bold transition-colors border border-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:hover:bg-blue-500/10 rounded-xl flex items-center gap-2"
                >
                  <span className="hidden sm:inline">Draft Message report</span>
                </button>
                <button
                  onClick={() => window.print()}
                  className="p-2 sm:px-4 sm:py-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-bold transition-colors bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded-xl flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span className="hidden sm:inline">Print</span>
                </button>
                <button
                  onClick={() => setShowDraftReport(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-8 overflow-y-auto flex-1 bg-slate-50/50 dark:bg-slate-900/20 print:bg-white print:p-0 print:overflow-visible">
              <div className="max-w-3xl mx-auto bg-white/70 dark:bg-slate-900/70 backdrop-blur-2xl p-6 sm:p-10 rounded-[32px] border border-white/60 dark:border-white/10 shadow-[0_8px_32px_rgba(0,0,0,0.04)] shadow-sm border border-slate-100 dark:border-slate-700 print:shadow-none print:border-none print:p-0">
                <div className="text-center mb-8">
                  <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">
                    Inventory Draft Report
                  </h1>
                  <p className="text-slate-500 dark:text-slate-400">
                    {title} {actualTabName ? `(${actualTabName})` : ""}
                  </p>
                  <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                    Generated on {new Date().toLocaleDateString()}
                  </p>
                </div>

                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4 relative print:hidden">
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter by item, SN, hostname..."
                      value={draftReportItemQuery}
                      onChange={(e) => setDraftReportItemQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                    />
                  </div>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 dark:text-slate-500" />
                    <input
                      type="text"
                      placeholder="Filter by type/tag..."
                      value={draftReportTypeQuery}
                      onChange={(e) => setDraftReportTypeQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
                    />
                  </div>
                </div>

                <div className="space-y-8">
                  {Object.entries(groupedItems).map(([group, groupItems]) => {
                    const activeItems = (groupItems as SheetRow[]).filter(
                      (i) => {
                        if (i._isDeleted) return false;
                        let matchesItem = true;
                        let matchesType = true;
                        if (draftReportItemQuery.trim()) {
                          const query = draftReportItemQuery.toLowerCase();
                          matchesItem =
                            (i.item || "").toLowerCase().includes(query) ||
                            (i.hostname || "").toLowerCase().includes(query) ||
                            (i.snid || "").toLowerCase().includes(query);
                        }
                        if (draftReportTypeQuery.trim()) {
                          const query = draftReportTypeQuery.toLowerCase();
                          matchesType =
                            (i.type || "").toLowerCase().includes(query) ||
                            (i.tag || "").toLowerCase().includes(query);
                        }
                        return matchesItem && matchesType;
                      },
                    );
                    if (activeItems.length === 0) return null;
                    return (
                      <div key={group} className="break-inside-avoid">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 border-b border-slate-200 dark:border-slate-700 pb-2 mb-4 flex items-center justify-between">
                          {group}
                          <span className="text-sm font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 print:bg-transparent px-3 py-1 rounded-full">
                            {activeItems.length} items
                          </span>
                        </h3>
                        <div className="overflow-x-auto">
                          <table className="w-full text-left border-collapse text-sm">
                            <thead>
                              <tr className="border-b border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400">
                                <th className="py-3 px-2 font-semibold w-1/2">
                                  Item
                                </th>
                                <th className="py-3 px-2 font-semibold">
                                  Type/Tag
                                </th>
                                <th className="py-3 px-2 font-semibold text-right">
                                  Qty
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                              {activeItems.map((item, idx) => {
                                const ItemIcon = getItemIcon(
                                  item.item || "",
                                  item.tag || "",
                                  item.type || "",
                                );
                                return (
                                  <tr key={`${item.row}-${idx}`}>
                                    <td className="py-3 px-2 align-top">
                                      <div className="flex items-start gap-2">
                                        <ItemIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 mt-0.5 shrink-0" />
                                        <div>
                                          <div className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                            {item.item}
                                            {type === "stock" && (parseInt(item.quantity) || 0) <= lowInventoryThreshold && (
                                              <span
                                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30"
                                                title={`Low inventory (threshold: ${lowInventoryThreshold})`}
                                              >
                                                <AlertCircle className="w-3 h-3" />
                                                Low
                                              </span>
                                            )}
                                          </div>
                                          {(item.hostname || item.snid) && (
                                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                              {item.hostname && (
                                                <span>{item.hostname}</span>
                                              )}
                                              {item.hostname && item.snid && (
                                                <span className="mx-1">•</span>
                                              )}
                                              {item.snid && (
                                                <span>SN: {item.snid}</span>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </td>
                                    <td className="py-3 px-2 align-top text-slate-600 dark:text-slate-300">
                                      {item.type || item.tag || "-"}
                                    </td>
                                    <td className="py-3 px-2 align-top text-right font-semibold text-slate-900 dark:text-slate-100">
                                      {item.quantity}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showTextReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-[32px] shadow-[0_8px_32px_rgba(0,0,0,0.08)] border border-white/60 dark:border-white/10 max-w-2xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-lg text-slate-900 dark:text-slate-100">
                Message Report
              </h3>
              <button
                onClick={() => setShowTextReport(false)}
                className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 dark:bg-slate-900/20">
              <textarea
                value={textReportContent}
                readOnly
                className="w-full h-[60vh] p-4 font-mono text-sm bg-white/60 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all dark:text-white"
              />
            </div>
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(textReportContent);
                  window.alert("Copied to clipboard!");
                }}
                className="px-4 py-2 text-white bg-indigo-600 font-bold hover:bg-indigo-700 transition-colors rounded-xl shadow-sm flex items-center gap-2"
              >
                <Copy className="w-4 h-4" />
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}

      {scannerOpenIdx !== null && (
        <BarcodeScanner
          onClose={() => setScannerOpenIdx(null)}
          onResult={(result) => {
            handleSnidChange(scannerOpenIdx, result);
            setScannerOpenIdx(null);
          }}
        />
      )}
    </div>
  );
}
