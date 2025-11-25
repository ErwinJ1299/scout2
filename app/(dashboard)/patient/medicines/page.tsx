"use client";

import React, { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/store/auth.store";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, Package, Clock, Loader2, ExternalLink, Pill, Stethoscope, Calendar, Upload, Camera } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { PartnerSelectDialog } from "@/components/medicines/PartnerSelectDialog";
import { PrescriptionOrderSheet } from "@/components/medicines/PrescriptionOrderSheet";
import { getEnabledPartners } from "@/lib/partners/pharmacyPartners";

interface MedicineOrder {
  id: string;
  userId: string;
  medicineName: string;
  source: string;
  partner: string;
  redirectUrl: string;
  createdAt: any;
}

interface SuggestedMedicineGroup {
  noteId: string;
  doctorId: string;
  doctorName: string;
  date: string;
  medicines: string[];
}

export default function MedicinesPage() {
  const { user } = useAuthStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [prescribedGroups, setPrescribedGroups] = useState<SuggestedMedicineGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | undefined>(undefined);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<string | undefined>(undefined);
  
  // OCR state
  const [uploading, setUploading] = useState(false);
  const [extractedMedicines, setExtractedMedicines] = useState<string[]>([]);
  const [currentPrescriptionId, setCurrentPrescriptionId] = useState<string | undefined>(undefined);
  
  // Order sheet state
  const [ocrMedicines, setOcrMedicines] = useState<string[]>([]);
  const [isOrderSheetOpen, setIsOrderSheetOpen] = useState(false);

  const partners = getEnabledPartners();

  useEffect(() => {
    if (user?.uid) {
      fetchOrders();
      fetchPrescribedMedicines();
    }
  }, [user]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/medicines/orders?userId=${user?.uid}&limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        setOrders(data.orders || []);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPrescribedMedicines = async () => {
    try {
      if (!user?.uid) return;

      const response = await fetch(`/api/medicines/prescribed?userId=${user.uid}&limit=10`);
      
      if (response.ok) {
        const data = await response.json();
        setPrescribedGroups(data.groups || []);
      }
    } catch (error) {
      console.error("Error fetching prescribed medicines:", error);
    }
  };

  const handleSearch = () => {
    const query = searchQuery.trim();
    
    if (!query) {
      toast({
        title: "⚠️ Empty Search",
        description: "Please enter a medicine name to search",
        variant: "destructive",
      });
      return;
    }

    setSelectedMedicine(query);
    setSelectedNoteId(undefined); // Manual search
    setDialogOpen(true);
  };

  const handleReorder = (medicineName: string) => {
    setSelectedMedicine(medicineName);
    setSelectedNoteId(undefined); // Manual reorder
    setDialogOpen(true);
  };

  const handlePrescribedMedicineClick = (medicineName: string, noteId: string) => {
    setSelectedMedicine(medicineName);
    setSelectedNoteId(noteId);
    setDialogOpen(true);
  };

  const handleOrderSuccess = () => {
    // Refresh orders after successful order
    fetchOrders();
    // Reset selections
    setSelectedNoteId(undefined);
    setSelectedPrescriptionId(undefined);
  };

  const handlePrescriptionUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      toast({
        title: "⚠️ No File Selected",
        description: "Please select an image file to upload",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: "❌ Invalid File Type",
        description: "Only JPG, JPEG, and PNG images are supported",
        variant: "destructive",
      });
      return;
    }

    try {
      setUploading(true);
      setExtractedMedicines([]);
      setCurrentPrescriptionId(undefined);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("userId", user?.uid || "");

      const response = await fetch("/api/medicines/prescription-ocr", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to process prescription");
      }

      if (data.medicines && data.medicines.length > 0) {
        setExtractedMedicines(data.medicines);
        setCurrentPrescriptionId(data.prescriptionId);
        setOcrMedicines(data.medicines);
        setIsOrderSheetOpen(true);
        
        toast({
          title: "✅ Prescription Processed",
          description: `Extracted ${data.medicines.length} medicine${data.medicines.length > 1 ? "s" : ""}. Select medicines to order.`,
        });
      } else {
        toast({
          title: "⚠️ No Medicines Found",
          description: "No medicines detected in the image. Try a clearer photo.",
          variant: "destructive",
        });
      }
    } catch (error: any) {
      console.error("Error uploading prescription:", error);
      toast({
        title: "❌ Upload Failed",
        description: error.message || "Failed to process prescription. Please try again.",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const handleExtractedMedicineClick = (medicineName: string) => {
    setSelectedMedicine(medicineName);
    setSelectedPrescriptionId(currentPrescriptionId);
    setSelectedNoteId(undefined);
    setDialogOpen(true);
  };

  const formatTimestamp = (timestamp: any) => {
    try {
      const date = timestamp?.toDate?.() || new Date(timestamp);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString();
    } catch {
      return "Recently";
    }
  };

  const getPartnerName = (partnerId: string) => {
    const partnerMap: Record<string, string> = {
      pharmeasy: "PharmEasy",
      tata1mg: "Tata 1mg",
      netmeds: "Netmeds",
      apollo: "Apollo",
      other: "Other",
    };
    return partnerMap[partnerId] || partnerId;
  };

  const getPartnerColor = (partnerId: string) => {
    const colorMap: Record<string, string> = {
      pharmeasy: "bg-purple-100 text-purple-700 border-purple-300",
      tata1mg: "bg-orange-100 text-orange-700 border-orange-300",
      netmeds: "bg-blue-100 text-blue-700 border-blue-300",
      apollo: "bg-green-100 text-green-700 border-green-300",
      other: "bg-gray-100 text-gray-700 border-gray-300",
    };
    return colorMap[partnerId] || "bg-gray-100 text-gray-700 border-gray-300";
  };

  const formatDate = (dateString: string | Date) => {
    try {
      const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Recently";
    }
  };

  // Get recent unique medicine names for suggestions
  const recentMedicines = orders
    .map(o => o.medicineName)
    .filter((name, index, self) => self.indexOf(name) === index)
    .slice(0, 5);

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Pill className="h-10 w-10 text-teal-600" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Smart Medicine Ordering
            </h1>
          </div>
          <p className="text-gray-600 dark:text-gray-400 text-lg">
            Search and order medicines from partnered pharmacies
          </p>
        </div>

        {/* Prescribed by Doctor Section */}
        {prescribedGroups.length > 0 && (
          <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Stethoscope className="h-5 w-5 text-blue-600" />
                Prescribed by Your Doctor
              </CardTitle>
              <CardDescription>
                Click on any medicine to order from partnered pharmacies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {prescribedGroups.map((group) => (
                <div
                  key={group.noteId}
                  className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-blue-200 dark:border-blue-800 space-y-3"
                >
                  {/* Doctor Info Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                        <Stethoscope className="h-3 w-3 mr-1" />
                        {group.doctorName}
                      </Badge>
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(group.date)}
                      </span>
                    </div>
                  </div>

                  {/* Medicine Chips */}
                  <div className="flex flex-wrap gap-2">
                    {group.medicines.map((medicine, index) => (
                      <Button
                        key={`${group.noteId}-${index}`}
                        variant="outline"
                        onClick={() => handlePrescribedMedicineClick(medicine, group.noteId)}
                        className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-100 hover:to-indigo-100 border-blue-300 text-blue-700 font-medium"
                      >
                        <Pill className="h-4 w-4 mr-2" />
                        {medicine}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Prescription Upload (OCR) Section */}
        <Card className="border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5 text-purple-600" />
              Upload Prescription (Image Recognition)
            </CardTitle>
            <CardDescription>
              Take a photo or upload your prescription image for automatic medicine extraction
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File Upload */}
            <div className="flex flex-col gap-3">
              <div className="flex gap-2 items-center">
                <Input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handlePrescriptionUpload}
                  disabled={uploading}
                  className="flex-1"
                />
                <Button
                  disabled={uploading}
                  variant="outline"
                  className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-300"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </>
                  )}
                </Button>
              </div>

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Extracting medicines from prescription using AI...</span>
                </div>
              )}
            </div>

            {/* Extracted Medicines */}
            {extractedMedicines.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge className="bg-purple-100 text-purple-700 border-purple-300">
                    ✨ {extractedMedicines.length} Medicine{extractedMedicines.length > 1 ? "s" : ""} Detected
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {extractedMedicines.map((medicine, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      onClick={() => handleExtractedMedicineClick(medicine)}
                      className="bg-gradient-to-r from-purple-50 to-pink-50 hover:from-purple-100 hover:to-pink-100 border-purple-300 text-purple-700 font-medium"
                    >
                      <Pill className="h-4 w-4 mr-2" />
                      {medicine}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Search Section */}
        <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5 text-teal-600" />
              Search Medicines
            </CardTitle>
            <CardDescription>Enter the medicine name to find it at partner pharmacies</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g., Metformin 500mg, Paracetamol, Aspirin..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSearch()}
                className="flex-1 h-12 text-base"
              />
              <Button
                onClick={handleSearch}
                disabled={searching}
                className="bg-gradient-to-r from-teal-600 to-cyan-600 hover:from-teal-700 hover:to-cyan-700 h-12 px-6"
              >
                {searching ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <Search className="h-5 w-5 mr-2" />
                    Search
                  </>
                )}
              </Button>
            </div>

            {/* Suggestions from recent orders */}
            {recentMedicines.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Recent searches:</p>
                <div className="flex flex-wrap gap-2">
                  {recentMedicines.map((medicine, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery(medicine);
                        setSelectedMedicine(medicine);
                        setSelectedNoteId(undefined); // Manual selection from recent
                        setDialogOpen(true);
                      }}
                      className="text-sm"
                    >
                      {medicine}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Orders Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-teal-600" />
              Recent Orders
            </CardTitle>
            <CardDescription>Your medicine ordering history</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
              </div>
            ) : orders.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Package className="h-16 w-16 mx-auto text-gray-300" />
                <p className="text-lg font-medium text-gray-600 dark:text-gray-400">
                  No orders yet
                </p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Search for a medicine above to place your first order through our partnered pharmacies
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {orders.map((order) => (
                  <div
                    key={order.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className="p-2 bg-teal-100 dark:bg-teal-900 rounded-lg">
                        <Pill className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-base">{order.medicineName}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge className={getPartnerColor(order.partner)}>
                            {getPartnerName(order.partner)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {formatTimestamp(order.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReorder(order.medicineName)}
                      className="ml-4"
                    >
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Reorder
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Partner Selection Dialog */}
      <PartnerSelectDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        medicineName={selectedMedicine}
        userId={user?.uid || ""}
        partners={partners}
        onSuccess={handleOrderSuccess}
        source={
          selectedNoteId 
            ? "clinical_note" 
            : selectedPrescriptionId 
            ? "prescription_ocr" 
            : "manual"
        }
        noteId={selectedNoteId}
        prescriptionId={selectedPrescriptionId}
      />

      {/* Prescription Order Sheet */}
      <PrescriptionOrderSheet
        open={isOrderSheetOpen}
        onOpenChange={setIsOrderSheetOpen}
        medicines={ocrMedicines}
        subtitle="Detected from prescription"
        onProceed={(selectedMedicines) => {
          // System currently supports single medicine order
          // Use first selected medicine
          if (selectedMedicines.length > 0) {
            setSelectedMedicine(selectedMedicines[0]);
            setSelectedPrescriptionId(currentPrescriptionId);
            setSelectedNoteId(undefined);
            setDialogOpen(true);
            setIsOrderSheetOpen(false);
          }
        }}
      />
    </div>
  );
}
