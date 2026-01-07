"use client"

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { X, Save, Loader2, Upload, ImageIcon } from "lucide-react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useOrganization } from "@/contexts/organization-context"
import { supabase } from "@/lib/supabase"
import { Plantation } from "@/types/database"
import { toast } from "sonner"

const plantationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  location: z.string().min(2, "Location must be at least 2 characters"),
  area_hectares: z.number().positive("Area must be positive"),
  tea_variety: z.string().min(1, "Tea variety is required"),
  number_of_plants: z.number().positive("Number of plants must be positive").optional(),
  established_date: z.string().optional(),
  image_url: z.string().optional(),
})

type PlantationFormData = z.infer<typeof plantationSchema>

interface PlantationFormProps {
  plantation?: Plantation | null
  onClose: () => void
}

export function PlantationForm({ plantation, onClose }: PlantationFormProps) {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.organization_id
  
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(plantation?.image_url || null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<PlantationFormData>({
    resolver: zodResolver(plantationSchema),
    defaultValues: {
      name: plantation?.name || "",
      location: plantation?.location || "",
      area_hectares: plantation?.area_hectares || 0,
      tea_variety: plantation?.tea_variety || "",
      number_of_plants: plantation?.number_of_plants || undefined,
      established_date: plantation?.established_date || "",
      image_url: plantation?.image_url || "",
    },
  })

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file")
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB")
      return
    }

    setUploading(true)

    try {
      // Create a unique file name
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `plantations/${fileName}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('plantation-images')
        .upload(filePath, file)

      if (uploadError) throw uploadError

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('plantation-images')
        .getPublicUrl(filePath)

      setImagePreview(publicUrl)
      setValue('image_url', publicUrl)
      toast.success("Image uploaded successfully")
    } catch (error: any) {
      console.error('Error uploading image:', error)
      toast.error(error.message || "Failed to upload image")
    } finally {
      setUploading(false)
    }
  }

  const removeImage = () => {
    setImagePreview(null)
    setValue('image_url', '')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const onSubmit = async (data: PlantationFormData) => {
    setLoading(true)
    
    // Prepare data - ensure tea_variety has a default value for database
    const plantationData = {
      ...data,
      tea_variety: data.tea_variety || "",
    }
    
    try {
      if (plantation) {
        // Update existing plantation
        const { error } = await supabase
          .from('plantations')
          .update(plantationData)
          .eq('id', plantation.id)
        
        if (error) throw error
        toast.success("Plantation updated successfully")
      } else {
        // Create new plantation
        const { error } = await supabase
          .from('plantations')
          .insert([{ ...plantationData, organization_id: orgId }])
        
        if (error) throw error
        toast.success("Plantation created successfully")
      }
      
      onClose()
    } catch (error: any) {
      console.error('Error saving plantation:', error)
      toast.error(error.message || "Failed to save plantation")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{plantation ? 'Edit Plantation' : 'Add New Plantation'}</CardTitle>
              <CardDescription>
                {plantation ? 'Update plantation details' : 'Add a new tea plantation to your management system'}
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Image Upload Section */}
            <div className="space-y-2">
              <Label>Plantation Image</Label>
              <div className="flex items-start gap-4">
                <div className="relative h-32 w-48 bg-muted rounded-lg overflow-hidden border-2 border-dashed border-muted-foreground/25">
                  {imagePreview ? (
                    <>
                      <Image
                        src={imagePreview}
                        alt="Plantation preview"
                        fill
                        sizes="192px"
                        className="object-cover"
                        quality={85}
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 h-6 w-6"
                        onClick={removeImage}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                      <ImageIcon className="h-8 w-8 mb-1" />
                      <span className="text-xs">No image</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4 mr-2" />
                    )}
                    {uploading ? 'Uploading...' : 'Upload Image'}
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Max: 5MB (JPG, PNG, WebP)
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Plantation Name *</Label>
                <Input
                  id="name"
                  {...register("name")}
                  placeholder="Highland Tea Estate"
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location *</Label>
                <Input
                  id="location"
                  {...register("location")}
                  placeholder="Nuwara Eliya, Sri Lanka"
                />
                {errors.location && (
                  <p className="text-sm text-destructive">{errors.location.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="area_hectares">Area (Hectares) *</Label>
                <Input
                  id="area_hectares"
                  type="number"
                  step="0.1"
                  {...register("area_hectares", { valueAsNumber: true })}
                  placeholder="120.5"
                />
                {errors.area_hectares && (
                  <p className="text-sm text-destructive">{errors.area_hectares.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tea_variety">Tea Variety *</Label>
                <Input
                  id="tea_variety"
                  {...register("tea_variety")}
                  placeholder="e.g., Ceylon Black, Green Tea"
                />
                {errors.tea_variety && (
                  <p className="text-sm text-destructive">{errors.tea_variety.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="number_of_plants">Number of Plants</Label>
                <Input
                  id="number_of_plants"
                  type="number"
                  step="1"
                  {...register("number_of_plants", { valueAsNumber: true })}
                  placeholder="50000"
                />
                {errors.number_of_plants && (
                  <p className="text-sm text-destructive">{errors.number_of_plants.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="established_date">Established Date</Label>
                <Input
                  id="established_date"
                  type="date"
                  {...register("established_date")}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                {plantation ? 'Update' : 'Create'} Plantation
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}