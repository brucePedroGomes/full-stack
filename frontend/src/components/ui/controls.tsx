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
  primary: 'bg-gray-700 text-white data-hover:bg-gray-600',
  secondary: 'bg-gray-100 data-hover:bg-gray-200',
  danger: 'bg-red-700 text-white data-hover:bg-red-600',
  plain: 'underline',
  icon: 'shrink-0 data-hover:bg-gray-100',
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
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-gray-700 disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
    />
  )
}

type ControlLabelProps = {
  label?: string
  description?: string
}

function ControlField({
  label,
  description,
  disabled,
  children,
}: ControlLabelProps & { disabled?: boolean; children: ReactNode }) {
  return (
    <Field disabled={disabled} className="min-w-0">
      {label ? <Label className="text-sm font-medium">{label}</Label> : null}
      {description ? (
        <Description className="text-sm text-gray-500">
          {description}
        </Description>
      ) : null}
      {children}
    </Field>
  )
}

const controlStyles =
  'block w-full min-w-0 rounded-lg bg-gray-100 px-3 py-1.5 text-sm focus-visible:outline-2 focus-visible:outline-gray-700 disabled:opacity-50'

export type InputProps = ComponentPropsWithRef<'input'> & ControlLabelProps

export function Input({
  label,
  description,
  className = '',
  ...props
}: InputProps) {
  return (
    <ControlField label={label} description={description} disabled={props.disabled}>
      <HeadlessInput
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
  className = '',
  ...props
}: TextareaProps) {
  return (
    <ControlField label={label} description={description} disabled={props.disabled}>
      <HeadlessTextarea
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
    <ControlField label={label} description={description} disabled={disabled}>
      <Listbox
        value={value}
        onChange={onChange}
        name={name}
        form={form}
        disabled={disabled}
      >
        <ListboxButton
          {...props}
          className={`${controlStyles} relative pr-8 text-left ${label || description ? 'mt-3' : ''} ${className}`}
        >
          <span className="block truncate">{selectedOption?.label ?? String(value)}</span>
          <Icon name="chevronDown" className="pointer-events-none absolute top-2.5 right-2.5 size-4 text-gray-500" />
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
              className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm data-focus:bg-gray-100 data-disabled:opacity-50"
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
