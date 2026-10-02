"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { FixedAssetWithCategory } from "@/lib/actions/fixed-assets";
import { deleteFixedAsset } from "@/lib/actions/fixed-assets";
import type { AssetCategory } from "@/lib/types";
import { FixedAssetFormDialog } from "./fixed-asset-form-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2 } from "lucide-react";

export function FixedAssetsPanel({ assets, categories }: { assets: FixedAssetWithCategory[]; categories: AssetCategory[] }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div className="space-y-4">
      <FixedAssetFormDialog categories={categories} />

      <div className="space-y-2">
        {assets.map((asset) => (
          <div key={asset.id} className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card p-3">
            <div>
              <p className="text-sm font-medium">{asset.name}</p>
              <p className="text-xs text-muted-foreground">
                {asset.category_name}
                {asset.brand ? ` · ${asset.brand}` : ""}
                {asset.model ? ` ${asset.model}` : ""}
                {asset.location ? ` · ${asset.location}` : ""}
              </p>
              {!asset.active && <Badge variant="secondary">Inativo</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <FixedAssetFormDialog asset={asset} categories={categories} />
              <Button
                variant="ghost"
                size="icon"
                disabled={isPending}
                onClick={() => {
                  if (!confirm(`Excluir "${asset.name}"?`)) return;
                  startTransition(async () => {
                    const result = await deleteFixedAsset(asset.id);
                    if (result?.error) toast.error(result.error);
                    else router.refresh();
                  });
                }}
              >
                <Trash2 size={16} />
              </Button>
            </div>
          </div>
        ))}
        {assets.length === 0 && <p className="text-sm text-muted-foreground py-4">Nenhum item cadastrado ainda.</p>}
      </div>
    </div>
  );
}
