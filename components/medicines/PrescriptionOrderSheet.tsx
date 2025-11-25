"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X, Pill, ChevronRight } from "lucide-react";

interface PrescriptionOrderSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicines: string[];
  subtitle?: string;
  onProceed: (selectedMedicines: string[]) => void;
}

export function PrescriptionOrderSheet({
  open,
  onOpenChange,
  medicines,
  subtitle,
  onProceed,
}: PrescriptionOrderSheetProps) {
  const [selectedMedicines, setSelectedMedicines] = useState<string[]>([]);

  // Initialize with all medicines selected
  useEffect(() => {
    if (open && medicines.length > 0) {
      setSelectedMedicines(medicines);
    }
  }, [open, medicines]);

  const handleToggleMedicine = (medicine: string) => {
    setSelectedMedicines((prev) =>
      prev.includes(medicine)
        ? prev.filter((m) => m !== medicine)
        : [...prev, medicine]
    );
  };

  const handleProceed = () => {
    if (selectedMedicines.length > 0) {
      onProceed(selectedMedicines);
      onOpenChange(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
            onClick={handleClose}
          />

          {/* Bottom Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 z-50 flex justify-center"
          >
            <Card className="w-full max-w-2xl rounded-t-3xl rounded-b-none border-t-4 border-teal-200 bg-white shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-200 p-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Pill className="h-6 w-6 text-teal-600" />
                    Select Medicines to Order
                  </h2>
                  {subtitle && (
                    <p className="text-sm text-slate-500 mt-1">{subtitle}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClose}
                  className="rounded-full hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Medicine List */}
              <ScrollArea className="max-h-[400px]">
                <div className="p-6 space-y-3">
                  {medicines.length === 0 ? (
                    <div className="text-center py-8 text-slate-500">
                      No medicines detected
                    </div>
                  ) : (
                    medicines.map((medicine, index) => (
                      <motion.div
                        key={medicine}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                      >
                        <label
                          htmlFor={`medicine-${index}`}
                          className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedMedicines.includes(medicine)
                              ? "border-teal-400 bg-teal-50"
                              : "border-slate-200 bg-slate-50 hover:border-slate-300"
                          }`}
                        >
                          <Checkbox
                            id={`medicine-${index}`}
                            checked={selectedMedicines.includes(medicine)}
                            onCheckedChange={() => handleToggleMedicine(medicine)}
                            className="h-5 w-5"
                          />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <Pill className="h-4 w-4 text-teal-600" />
                              <span className="font-medium text-slate-800">
                                {medicine}
                              </span>
                            </div>
                          </div>
                        </label>
                      </motion.div>
                    ))
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="border-t border-slate-200 p-6 bg-slate-50">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-slate-600">
                    {selectedMedicines.length} of {medicines.length} selected
                  </div>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={handleClose}
                      className="px-6"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleProceed}
                      disabled={selectedMedicines.length === 0}
                      className="px-6 bg-teal-600 hover:bg-teal-700 text-white"
                    >
                      Continue to Pharmacy
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
