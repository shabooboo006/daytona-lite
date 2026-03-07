/*
 * Copyright Daytona Platforms Inc.
 * SPDX-License-Identifier: AGPL-3.0
 */

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Spinner } from '@/components/ui/spinner'
import { useCreateSnapshotMutation } from '@/hooks/mutations/useCreateSnapshotMutation'
import { useApi } from '@/hooks/useApi'
import { useConfig } from '@/hooks/useConfig'
import { useSelectedOrganization } from '@/hooks/useSelectedOrganization'
import { handleApiError } from '@/lib/error-handling'
import { translateLiteralText } from '@/i18n/literalTranslations'
import { useForm } from '@tanstack/react-form'
import { Plus } from 'lucide-react'
import { Ref, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'
import { ScrollArea } from '../ui/scroll-area'

const IMAGE_NAME_REGEX = /^[a-zA-Z0-9_.\-:]+(\/[a-zA-Z0-9_.\-:]+)*(@sha256:[a-f0-9]{64})?$/
const IMAGE_TAG_OR_DIGEST_REGEX = /^[^@]+@sha256:[a-f0-9]{64}$|^(?!.*@sha256:).*:.+$/

const snapshotNameSchema = z
  .string()
  .min(1, 'Snapshot name is required')
  .refine((name) => IMAGE_NAME_REGEX.test(name), 'Only letters, digits, dots, colons, slashes and dashes are allowed')

const imageNameSchema = z
  .string()
  .min(1, 'Image name is required')
  .refine((name) => IMAGE_NAME_REGEX.test(name), 'Only letters, digits, dots, colons, slashes and dashes are allowed')
  .refine(
    (name) => IMAGE_TAG_OR_DIGEST_REGEX.test(name),
    'Image must include a tag (e.g., ubuntu:22.04) or digest (@sha256:...)',
  )
  .refine((name) => !name.endsWith(':latest'), 'Images with tag ":latest" are not allowed')

const formSchema = z.object({
  name: snapshotNameSchema,
  imageName: imageNameSchema,
  entrypoint: z.string().optional(),
  cpu: z.number().min(1).optional(),
  memory: z.number().min(1).optional(),
  disk: z.number().min(1).optional(),
})

type FormValues = z.infer<typeof formSchema>

type LocalImageItem = {
  imageName: string
  sizeGB: number
  entrypoint?: string[]
  cmd?: string[]
  runnerIds: string[]
  runnerCount: number
}

const defaultValues: FormValues = {
  name: '',
  imageName: '',
  entrypoint: '',
  cpu: undefined,
  memory: undefined,
  disk: undefined,
}

export const CreateSnapshotDialog = ({ className, ref }: { className?: string; ref?: Ref<{ open: () => void }> }) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [localImages, setLocalImages] = useState<LocalImageItem[]>([])
  const [localImageQuery, setLocalImageQuery] = useState('')
  const [localImagesLoading, setLocalImagesLoading] = useState(false)
  const [localImagesError, setLocalImagesError] = useState<string | null>(null)

  const api = useApi()
  const config = useConfig()
  const { selectedOrganization } = useSelectedOrganization()
  const { reset: resetCreateSnapshotMutation, ...createSnapshotMutation } = useCreateSnapshotMutation()
  const formRef = useRef<HTMLFormElement>(null)

  useImperativeHandle(ref, () => ({
    open: () => setOpen(true),
  }))

  const form = useForm({
    defaultValues,
    validators: {
      onSubmit: formSchema,
    },
    onSubmitInvalid: () => {
      const form = formRef.current
      if (!form) return
      const invalidInput = form.querySelector('[aria-invalid="true"]') as HTMLInputElement | null
      if (invalidInput) {
        invalidInput.scrollIntoView({ behavior: 'smooth', block: 'center' })
        invalidInput.focus()
      }
    },
    onSubmit: async ({ value }) => {
      if (!selectedOrganization?.id) {
        toast.error(translateLiteralText('Select an organization to create a snapshot.'))
        return
      }

      const trimmedEntrypoint = value.entrypoint?.trim()

      try {
        await createSnapshotMutation.mutateAsync({
          snapshot: {
            name: value.name.trim(),
            imageName: value.imageName.trim(),
            entrypoint: trimmedEntrypoint ? trimmedEntrypoint.split(' ') : undefined,
            cpu: value.cpu,
            memory: value.memory,
            disk: value.disk,
          },
          organizationId: selectedOrganization.id,
        })

        toast.success(`${translateLiteralText('Creating snapshot')} ${value.name.trim()}`)
        setOpen(false)
      } catch (error) {
        handleApiError(error, translateLiteralText('Failed to create snapshot'))
      }
    },
  })

  const resetState = useCallback(() => {
    form.reset(defaultValues)
    setLocalImageQuery('')
    setLocalImages([])
    setLocalImagesError(null)
    resetCreateSnapshotMutation()
  }, [resetCreateSnapshotMutation, form])

  useEffect(() => {
    if (open) {
      resetState()
    }
  }, [open, resetState])

  useEffect(() => {
    if (!open || !selectedOrganization?.id || config.localImageScanEnabled === false) {
      return
    }

    const timeoutId = window.setTimeout(async () => {
      setLocalImagesLoading(true)
      setLocalImagesError(null)

      try {
        const response = await api.axiosInstance.get<LocalImageItem[]>('/snapshots/local-images', {
          params: {
            regionId: selectedOrganization.defaultRegionId || undefined,
            q: localImageQuery || undefined,
          },
          headers: {
            'X-Daytona-Organization-ID': selectedOrganization.id,
          },
        })

        setLocalImages(response.data)
      } catch (error) {
        setLocalImages([])
        setLocalImagesError(
          error instanceof Error ? error.message : translateLiteralText('Failed to load local images'),
        )
      } finally {
        setLocalImagesLoading(false)
      }
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [api, config.localImageScanEnabled, localImageQuery, open, selectedOrganization?.defaultRegionId, selectedOrganization?.id])

  const applyLocalImage = useCallback(
    (image: LocalImageItem) => {
      form.setFieldValue('imageName', image.imageName)
      form.setFieldValue('entrypoint', image.entrypoint?.join(' ') || '')

      const currentName = form.getFieldValue('name')
      if (!currentName?.trim()) {
        form.setFieldValue('name', toSnapshotName(image.imageName))
      }
    },
    [form],
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="default" size="sm" className="ml-auto" title={t('snapshotsModule.create')}>
          <Plus className="w-4 h-4" />
          {t('snapshotsModule.create')}
        </Button>
      </DialogTrigger>
      <DialogContent className={className}>
        <DialogHeader>
          <DialogTitle>Create New Snapshot</DialogTitle>
          <DialogDescription>
            Register a new snapshot to be used for spinning up sandboxes in your organization.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea fade="mask" className="h-[500px] overflow-auto -mx-5">
          <form
            ref={formRef}
            id="create-snapshot-form"
            className="gap-6 flex flex-col px-5"
            onSubmit={(e) => {
              e.preventDefault()
              e.stopPropagation()
              form.handleSubmit()
            }}
          >
            <form.Field name="name">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Snapshot Name</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="ubuntu-4vcpu-8ram-100gb"
                    />
                    <FieldDescription>
                      The name you will use in your client app (SDK, CLI) to reference the snapshot.
                    </FieldDescription>
                    {field.state.meta.errors.length > 0 && field.state.meta.isTouched && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            <form.Field name="imageName">
              {(field) => {
                const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <Field data-invalid={isInvalid}>
                    <FieldLabel htmlFor={field.name}>Image</FieldLabel>
                    <Input
                      aria-invalid={isInvalid}
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      placeholder="ubuntu:22.04"
                    />
                    <FieldDescription>
                      Must include either a tag (e.g., ubuntu:22.04) or a digest. The tag "latest" is not allowed.
                    </FieldDescription>
                    {field.state.meta.errors.length > 0 && field.state.meta.isTouched && (
                      <FieldError errors={field.state.meta.errors} />
                    )}
                  </Field>
                )
              }}
            </form.Field>

            {config.localImageMode !== false && (
              <Field>
                <FieldLabel htmlFor="local-image-search">Local images</FieldLabel>
                <Input
                  id="local-image-search"
                  value={localImageQuery}
                  onChange={(e) => setLocalImageQuery(e.target.value)}
                  placeholder="Search local images on ready runners"
                />
                <FieldDescription>
                  Local images are the default source. Registry fallback is only used when the selected image is not
                  available on a ready runner.
                </FieldDescription>
                <div className="rounded-md border overflow-hidden">
                  <div className="max-h-56 overflow-auto">
                    {localImagesLoading ? (
                      <div className="flex items-center gap-2 px-3 py-4 text-sm text-muted-foreground">
                        <Spinner />
                        Loading local images...
                      </div>
                    ) : localImagesError ? (
                      <div className="px-3 py-4 text-sm text-destructive">{localImagesError}</div>
                    ) : localImages.length === 0 ? (
                      <div className="px-3 py-4 text-sm text-muted-foreground">
                        No local images found in the selected region.
                      </div>
                    ) : (
                      localImages.map((image) => (
                        <button
                          key={image.imageName}
                          type="button"
                          className="w-full border-b last:border-b-0 px-3 py-3 text-left hover:bg-muted/50 transition-colors"
                          onClick={() => applyLocalImage(image)}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="font-medium truncate">{image.imageName}</div>
                              <div className="text-xs text-muted-foreground flex flex-wrap gap-2 mt-1">
                                <span>{image.sizeGB.toFixed(2)} GiB</span>
                                <span>{image.runnerCount} runner{image.runnerCount > 1 ? 's' : ''}</span>
                                {image.entrypoint?.length ? <span>entrypoint: {image.entrypoint.join(' ')}</span> : null}
                              </div>
                            </div>
                            <Badge variant="secondary">Use</Badge>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </Field>
            )}

            <Field>
              <FieldLabel>Region</FieldLabel>
              <Input value={selectedOrganization?.defaultRegionId ?? 'default'} readOnly />
              <FieldDescription>
                Snapshots are created in your organization&apos;s default region automatically. No manual region
                selection is required.
              </FieldDescription>
            </Field>

            <div className="flex flex-col gap-2">
              <Label className="text-sm font-medium">Resources</Label>
              <div className="flex flex-col gap-2">
                <form.Field name="cpu">
                  {(field) => (
                    <div className="flex items-center gap-4">
                      <Label htmlFor={field.name} className="w-32 flex-shrink-0">
                        Compute (vCPU):
                      </Label>
                      <Input
                        id={field.name}
                        type="number"
                        className="w-full"
                        min="1"
                        placeholder="1"
                        value={field.state.value ?? ''}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || undefined)}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="memory">
                  {(field) => (
                    <div className="flex items-center gap-4">
                      <Label htmlFor={field.name} className="w-32 flex-shrink-0">
                        Memory (GiB):
                      </Label>
                      <Input
                        id={field.name}
                        type="number"
                        className="w-full"
                        min="1"
                        placeholder="1"
                        value={field.state.value ?? ''}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || undefined)}
                      />
                    </div>
                  )}
                </form.Field>
                <form.Field name="disk">
                  {(field) => (
                    <div className="flex items-center gap-4">
                      <Label htmlFor={field.name} className="w-32 flex-shrink-0">
                        Storage (GiB):
                      </Label>
                      <Input
                        id={field.name}
                        type="number"
                        className="w-full"
                        min="1"
                        placeholder="3"
                        value={field.state.value ?? ''}
                        onChange={(e) => field.handleChange(parseInt(e.target.value) || undefined)}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
              <FieldDescription>
                If not specified, default values will be used (1 vCPU, 1 GiB memory, 3 GiB storage).
              </FieldDescription>
            </div>

            <form.Field name="entrypoint">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>Entrypoint (optional)</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    value={field.state.value ?? ''}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    placeholder="sleep infinity"
                  />
                  <FieldDescription>
                    Ensure that the entrypoint is a long running command. If not provided, or if the snapshot does not
                    have an entrypoint, 'sleep infinity' will be used as the default.
                  </FieldDescription>
                </Field>
              )}
            </form.Field>
          </form>
        </ScrollArea>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                form="create-snapshot-form"
                variant="default"
                disabled={!canSubmit || isSubmitting || !selectedOrganization?.id}
              >
                {isSubmitting && <Spinner />}
                Create
              </Button>
            )}
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function toSnapshotName(imageName: string): string {
  return imageName
    .replace(/@sha256:[a-f0-9]{64}$/i, '')
    .replace(/[^a-zA-Z0-9_.:/-]+/g, '-')
    .replace(/[/:@]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
}
