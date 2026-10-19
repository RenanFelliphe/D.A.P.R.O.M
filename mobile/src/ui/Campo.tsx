import { useState, type ComponentRef, type Ref } from "react";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { cores, espaco, raio } from "@/tema/tema";

export interface CampoProps extends TextInputProps {
  rotulo: string;
  /** A mensagem junto do campo; com ela o campo fica vermelho. */
  erro?: string;
  ajuda?: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}

/** Campo de texto com rótulo, ajuda e a mensagem de erro logo abaixo. */
export function Campo({ rotulo, erro, ajuda, ref, style, onFocus, onBlur, ...props }: CampoProps) {
  const [focado, setFocado] = useState(false);
  return (
    <View style={estilos.campo}>
      <Text style={estilos.rotulo}>{rotulo}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={rotulo}
        placeholderTextColor={cores.tinta4}
        style={[estilos.entrada, focado && estilos.focado, erro ? estilos.comErro : null, style]}
        onFocus={(e) => {
          setFocado(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocado(false);
          onBlur?.(e);
        }}
        {...props}
      />
      {erro ? (
        <Text accessibilityRole="alert" style={estilos.erro}>
          {erro}
        </Text>
      ) : ajuda ? (
        <Text style={estilos.ajuda}>{ajuda}</Text>
      ) : null}
    </View>
  );
}

type PropsDoCampoDeFormulario<T extends FieldValues> = Omit<CampoProps, "value" | "onChangeText" | "onBlur" | "ref" | "erro"> & { control: Control<T>; nome: Path<T> };

/** `Campo` ligado ao React Hook Form: o erro do esquema Zod aparece junto do campo e o foco vai para o primeiro campo com erro. */
export function CampoDeFormulario<T extends FieldValues>({ control, nome, ...props }: PropsDoCampoDeFormulario<T>) {
  return (
    <Controller
      control={control}
      name={nome}
      render={({ field, fieldState }) => <Campo {...props} ref={field.ref} value={String(field.value ?? "")} onChangeText={field.onChange} onBlur={field.onBlur} erro={fieldState.error?.message} />}
    />
  );
}

const estilos = StyleSheet.create({
  campo: { gap: 6 },
  rotulo: { fontSize: 14, fontWeight: "600", color: cores.tinta2 },
  entrada: { minHeight: 48, borderWidth: 1, borderColor: cores.linha, borderRadius: raio.m, backgroundColor: cores.superficie, paddingHorizontal: espaco.m, fontSize: 16, color: cores.tinta },
  focado: { borderColor: cores.marca },
  comErro: { borderColor: cores.perigo, backgroundColor: cores.perigoFundo },
  erro: { fontSize: 13, color: cores.perigo },
  ajuda: { fontSize: 13, color: cores.tinta4 },
});
