import {
  Button as HeadlessButton,
  Description,
  Field,
  Fieldset as HeadlessFieldset,
  Input as HeadlessInput,
  Label,
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
  Textarea as HeadlessTextarea,
} from '@headlessui/react'
import type { ComponentPropsWithRef, ReactNode } from 'react'
import { Icon } from './Icon'

const buttonStyles = {
  primary: 'bg-gray-700 text-white enabled:data-hover:bg-gray-600 enabled:data-active:bg-gray-800 enabled:data-hover:data-active:bg-gray-800',
  secondary: 'bg-gray-100 enabled:data-hover:bg-gray-200 enabled:data-active:bg-gray-300 enabled:data-hover:data-active:bg-gray-300',
  danger: 'bg-red-700 text-white enabled:data-hover:bg-red-600 enabled:data-active:bg-red-800 enabled:data-hover:data-active:bg-red-800',
  plain: 'underline underline-offset-4 enabled:data-hover:bg-gray-100 enabled:data-active:bg-gray-200 enabled:data-hover:data-active:bg-gray-200',
  icon: 'shrink-0 enabled:data-hover:bg-gray-100 enabled:data-active:bg-gray-200 enabled:data-hover:data-active:bg-gray-200',
}

export type ButtonProps = ComponentPropsWithRef<'button'> & {
  variant?: keyof typeof buttonStyles
}

export function Button({
  variant = 'secondary',
  type = 'button',
  className = '',
  ...props
}: ButtonProps) {
  return (
    <HeadlessButton
      {...props}
      type={type}
      className={`inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 disabled:cursor-not-allowed disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    />
  )
}

type ControlLabelProps = {
  label?: string
  description?: string
  error?: string
}

function ControlField({
  label,
  description,
  error,
  required,
  disabled,
  children,
}: ControlLabelProps & {
  required?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <Field disabled={disabled} className="min-w-0">
      {label ? (
        <div className="flex flex-wrap items-baseline gap-1 text-sm">
          <Label className="font-medium">{label}</Label>
          {required ? (
            <span aria-hidden="true" className="text-gray-600">(required)</span>
          ) : null}
        </div>
      ) : null}
      {description ? (
        <Description className="text-sm text-gray-500">
          {description}
        </Description>
      ) : null}
      {children}
      {error ? (
        <Description role="alert" className="mt-2 text-sm text-red-700">
          {error}
        </Description>
      ) : null}
    </Field>
  )
}

const controlStyles =
  'block min-h-11 w-full min-w-0 rounded-lg bg-gray-100 px-3 py-2 text-base sm:text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-700 aria-invalid:ring-1 aria-invalid:ring-red-700 disabled:cursor-not-allowed disabled:opacity-50'

export type InputProps = ComponentPropsWithRef<'input'> & ControlLabelProps

export function Input({
  label,
  description,
  error,
  className = '',
  ...props
}: InputProps) {
  return (
    <ControlField
      label={label}
      description={description}
      error={error}
      required={props.required}
      disabled={props.disabled}
    >
      <HeadlessInput
        invalid={Boolean(error)}
        {...props}
        className={`${controlStyles} ${label || description ? 'mt-3' : ''} ${className}`}
      />
    </ControlField>
  )
}

export type TextareaProps = ComponentPropsWithRef<'textarea'> & ControlLabelProps

export function Textarea({
  label,
  description,
  error,
  className = '',
  ...props
}: TextareaProps) {
  return (
    <ControlField
      label={label}
      description={description}
      error={error}
      required={props.required}
      disabled={props.disabled}
    >
      <HeadlessTextarea
        invalid={Boolean(error)}
        {...props}
        className={`${controlStyles} ${label || description ? 'mt-3' : ''} ${className}`}
      />
    </ControlField>
  )
}

export type SelectOption<Value extends string | number> = {
  value: Value
  label: string
  disabled?: boolean
}

export type SelectProps<Value extends string | number> = Omit<
  ComponentPropsWithRef<'button'>,
  'children' | 'value' | 'defaultValue' | 'onChange' | 'type'
> & ControlLabelProps & {
  options: readonly SelectOption<Value>[]
  value: NoInfer<Value>
  onChange: (value: Value) => void
}

export function Select<Value extends string | number>({
  label,
  description,
  error,
  options,
  value,
  onChange,
  name,
  form,
  disabled,
  className = '',
  ...props
}: SelectProps<Value>) {
  const selectedOption = options.find((option) => option.value === value)

  return (
    <ControlField label={label} description={description} error={error} disabled={disabled}>
      <Listbox
        value={value}
        onChange={onChange}
        name={name}
        form={form}
        disabled={disabled}
      >
        <ListboxButton
          aria-invalid={error ? true : undefined}
          {...props}
          className={`${controlStyles} relative cursor-pointer pr-8 text-left enabled:data-hover:bg-gray-200 enabled:data-active:bg-gray-300 enabled:data-hover:data-active:bg-gray-300 ${label || description ? 'mt-3' : ''} ${className}`}
        >
          <span className="block truncate">{selectedOption?.label ?? String(value)}</span>
          <Icon name="chevronDown" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-gray-500" />
        </ListboxButton>
        <ListboxOptions
          anchor="bottom"
          className="z-60 w-(--button-width) rounded-lg bg-white p-1 shadow-lg [--anchor-gap:4px] focus:outline-none"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              disabled={option.disabled}
              className="group flex min-h-11 cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm data-focus:bg-gray-100 data-focus:outline-2 data-focus:-outline-offset-2 data-focus:outline-gray-700 data-disabled:cursor-not-allowed data-disabled:opacity-50"
            >
              <Icon name="check" className="invisible size-4 shrink-0 group-data-selected:visible" />
              <span className="min-w-0 wrap-anywhere">{option.label}</span>
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </ControlField>
  )
}

export type FieldsetProps = ComponentPropsWithRef<'fieldset'>

export function Fieldset({ className = '', ...props }: FieldsetProps) {
  return (
    <HeadlessFieldset
      {...props}
      className={`min-w-0 space-y-4 rounded-xl bg-gray-50 p-4 ${className}`}
    />
  )
}
