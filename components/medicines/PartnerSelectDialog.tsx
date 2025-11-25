"use client";

import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, ExternalLink, Pill, ArrowRight } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Partner {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
}

interface PartnerSelectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  medicineName: string;
  userId: string;
  partners: Partner[];
  onSuccess?: () => void;
  source?: "manual" | "clinical_note" | "prescription_ocr";
  noteId?: string;
  prescriptionId?: string;
}

export function PartnerSelectDialog({
  open,
  onOpenChange,
  medicineName,
  userId,
  partners,
  onSuccess,
  source = "manual",
  noteId,
  prescriptionId,
}: PartnerSelectDialogProps) {
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  const handlePartnerSelect = async (partnerId: string) => {
    try {
      setLoading(true);
      setSelectedPartnerId(partnerId);

      const response = await fetch("/api/medicines/order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          medicineName,
          partnerId,
          source,
          ...(noteId && { noteId }), // Include noteId only if provided
          ...(prescriptionId && { prescriptionId }), // Include prescriptionId only if provided
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create order");
      }

      const data = await response.json();

      if (data.success && data.redirectUrl) {
        setRedirecting(true);
        toast({
          title: "✅ Order Created",
          description: `Redirecting to ${partners.find(p => p.id === partnerId)?.name}...`,
        });

        // Call success callback before redirect
        if (onSuccess) {
          onSuccess();
        }

        // Redirect after short delay
        setTimeout(() => {
          window.location.href = data.redirectUrl;
        }, 500);
      }
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast({
        title: "❌ Error",
        description: error.message || "Failed to create order. Please try again.",
        variant: "destructive",
      });
      setLoading(false);
      setRedirecting(false);
      setSelectedPartnerId(null);
    }
  };

  const isRecommended = (partnerId: string) => {
    return partnerId === "pharmeasy" || partnerId === "tata1mg";
  };

  const getPartnerLogo = (partnerId: string) => {
    // Placeholder - can be replaced with actual logos
    const logos: Record<string, string> = {
      pharmeasy: "💊",
      tata1mg: "🏥",
      netmeds: "💉",
      apollo: "⚕️",
    };
    return logos[partnerId] || "🔷";
  };

  if (redirecting) {
    return (
      <Dialog open={open} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl rounded-2xl">
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-teal-600" />
            <h3 className="text-xl font-semibold text-slate-900">Redirecting...</h3>
            <p className="text-sm text-slate-500 text-center">
              Please wait while we redirect you to the pharmacy partner
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden bg-white border-0 shadow-2xl rounded-2xl">
        
        {/* Header Section */}
        <div className="bg-slate-50 p-6 border-b border-slate-100">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-slate-900">Select Pharmacy</DialogTitle>
          </DialogHeader>
          
          {/* Medicine Card */}
          <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
            <div className="h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center text-teal-600 shrink-0">
              <Pill size={24} />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Buying</p>
              <p className="text-lg font-bold text-slate-900 leading-tight">{medicineName}</p>
            </div>
          </div>
        </div>

        {/* Partners List */}
        <div className="p-4 space-y-3 max-h-[60vh] overflow-y-auto bg-white">
          {partners.filter(p => p.enabled).map((partner) => (
            <button
              key={partner.id}
              onClick={() => handlePartnerSelect(partner.id)}
              disabled={loading}
              className={`group w-full flex items-center gap-4 p-4 rounded-xl border transition-all duration-200 text-left relative overflow-hidden
                ${selectedPartnerId === partner.id 
                  ? "border-teal-500 bg-teal-50/50 ring-1 ring-teal-500" 
                  : "border-slate-200 hover:border-teal-400 hover:shadow-md bg-white"
                }
                ${loading && selectedPartnerId !== partner.id ? "opacity-50" : ""}
              `}
            >
              {/* Selection Bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 transition-colors ${selectedPartnerId === partner.id ? 'bg-teal-500' : 'bg-transparent group-hover:bg-teal-200'}`} />

              {/* Logo Box */}
              <div className="h-14 w-14 shrink-0 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-3xl shadow-sm">
                {getPartnerLogo(partner.id)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  {/* Softer text color for better readability */}
                  <span className="font-bold text-lg text-slate-700">{partner.name}</span>
                  
                  {isRecommended(partner.id) && (
                    <span className="px-2 py-0.5 rounded-md bg-teal-100 text-teal-700 text-[10px] font-bold uppercase tracking-wide border border-teal-200">
                      Recommended
                    </span>
                  )}
                </div>
                {partner.description && (
                  <p className="text-sm text-slate-500 truncate font-medium">{partner.description}</p>
                )}
              </div>

              {/* Action Icon */}
              <div className="shrink-0 text-slate-300 group-hover:text-teal-600 transition-colors">
                {loading && selectedPartnerId === partner.id ? (
                  <div className="animate-spin h-5 w-5 border-2 border-teal-600 border-t-transparent rounded-full" />
                ) : (
                  <ArrowRight size={20} strokeWidth={2.5} />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <ExternalLink size={12} />
            Redirects to partner website
          </p>
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-200"
            disabled={loading}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
