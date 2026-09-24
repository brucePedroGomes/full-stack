import {
  Button as HeadlessButton,
  Description,
  Field,
  Fieldset as HeadlessFieldset,
  Input as HeadlessInput,
  Label,
  Select as HeadlessSelect,
  Textarea as HeadlessTextarea,
} from '@headlessui/react'
import {
  useCallback,
  type ChangeEvent,
  type ComponentPropsWithRef,
  type ReactNode,
} from 'react'

const buttonStyles = {
  primary: 'bg-blue-700 px-4 text-white data-hover:bg-blue-800',
  secondary: 'border border-gray-300 bg-white px-4 data-hover:bg-gray-100',
  danger: 'border border-red-200 px-3 text-red-700 data-hover:bg-red-50',
  plain: 'underline',
  icon: 'size-11 shrink-0 text-gray-600 data-hover:bg-gray-100',
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
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-blue-600 data-disabled:opacity-50 ${buttonStyles[variant]} ${className}`}
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
      {label ? <Label className="block">{label}</Label> : null}
      {children}
      {description ? (
        <Description className="mt-1 text-sm text-gray-600">
          {description}
        </Description>
      ) : null}
    </Field>
  )
}

const controlStyles =
  'block min-h-11 w-full min-w-0 rounded border border-gray-300 bg-white px-3 focus:outline-2 focus:outline-blue-600 data-disabled:opacity-50'

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
        className={`${controlStyles} ${label ? 'mt-1' : ''} ${className}`}
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
        className={`${controlStyles} py-3 ${label ? 'mt-1' : ''} ${className}`}
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
  ComponentPropsWithRef<'select'>,
  'children' | 'value' | 'defaultValue' | 'onChange' | 'multiple'
> & ControlLabelProps & {
  options: readonly SelectOption<Value>[]
  value: NoInfer<Value>
  onChange: (value: Value) => void
}

export function Select<Value extends string | number>({
  label,
  description,
  options,
  onChange,
  className = '',
  ...props
}: SelectProps<Value>) {
  const handleChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const option = options.find(
        (item) => String(item.value) === event.currentTarget.value,
      )
      if (option) onChange(option.value)
    },
    [onChange, options],
  )

  return (
    <ControlField label={label} description={description} disabled={props.disabled}>
      <HeadlessSelect
        {...props}
        onChange={handleChange}
        className={`${controlStyles} ${label ? 'mt-1' : ''} ${className}`}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </HeadlessSelect>
    </ControlField>
  )
}

export type FieldsetProps = ComponentPropsWithRef<'fieldset'>

export function Fieldset({ className = '', ...props }: FieldsetProps) {
  return (
    <HeadlessFieldset
      {...props}
      className={`min-w-0 space-y-4 data-disabled:opacity-60 ${className}`}
    />
  )
}
