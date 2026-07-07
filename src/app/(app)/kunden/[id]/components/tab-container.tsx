"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  LayoutDashboard,
  BarChart3,
  PackageSearch,
  Truck,
} from "lucide-react";

interface TabContainerProps {
  defaultTab?: string;
  children: {
    overview: React.ReactNode;
    revenue: React.ReactNode;
    orders: React.ReactNode;
    defaults: React.ReactNode;
  };
}

export function TabContainer({ defaultTab = "overview", children }: TabContainerProps) {
  const [activeTab, setActiveTab] = useState(defaultTab);

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="mb-6 grid w-full grid-cols-4">
        <TabsTrigger
          value="overview"
          className="flex flex-col items-center gap-0.5 px-1 py-1.5 h-auto text-xs sm:text-sm sm:flex-row sm:gap-1.5 sm:px-3"
        >
          <LayoutDashboard className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden sm:inline">Übersicht</span>
          <span className="sm:hidden">Übers.</span>
        </TabsTrigger>
        <TabsTrigger
          value="revenue"
          className="flex flex-col items-center gap-0.5 px-1 py-1.5 h-auto text-xs sm:text-sm sm:flex-row sm:gap-1.5 sm:px-3"
        >
          <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden sm:inline">Umsatz</span>
          <span className="sm:hidden">Ums.</span>
        </TabsTrigger>
        <TabsTrigger
          value="orders"
          className="flex flex-col items-center gap-0.5 px-1 py-1.5 h-auto text-xs sm:text-sm sm:flex-row sm:gap-1.5 sm:px-3"
        >
          <PackageSearch className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden sm:inline">Bestellhistorie</span>
          <span className="sm:hidden">Best.</span>
        </TabsTrigger>
        <TabsTrigger
          value="defaults"
          className="flex flex-col items-center gap-0.5 px-1 py-1.5 h-auto text-xs sm:text-sm sm:flex-row sm:gap-1.5 sm:px-3"
        >
          <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
          <span className="hidden sm:inline">Logistik &amp; Abholung</span>
          <span className="sm:hidden">Logistik</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="mt-0">
        {children.overview}
      </TabsContent>
      <TabsContent value="revenue" className="mt-0">
        {children.revenue}
      </TabsContent>
      <TabsContent value="orders" className="mt-0">
        {children.orders}
      </TabsContent>
      <TabsContent value="defaults" className="mt-0">
        {children.defaults}
      </TabsContent>
    </Tabs>
  );
}
