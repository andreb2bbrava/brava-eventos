import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
try {
const body = await request.json();

const {
  email,
  password,
  role,
} = body;

console.log("EMAIL:", email);
console.log("ROLE:", role);

const {
  data,
  error,
} = await supabaseAdmin.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
});

console.log("AUTH DATA:", data);
console.log("AUTH ERROR:", error);

if (error) {
  return NextResponse.json(
    {
      error: error.message,
    },
    {
      status: 400,
    }
  );
}

const {
  data: usuarioData,
  error: erroUsuario,
} = await supabaseAdmin
  .from("usuarios")
  .insert([
    {
      id: data.user.id,
      email,
      role,
    },
  ])
  .select();

console.log("USUARIO DATA:", usuarioData);
console.log("USUARIO ERROR:", erroUsuario);

if (erroUsuario) {
  return NextResponse.json(
    {
      error: erroUsuario.message,
    },
    {
      status: 400,
    }
  );
}

return NextResponse.json({
  success: true,
});

} catch (error) {
console.log("ERRO GERAL:", error);

return NextResponse.json(
  {
    error: "Erro interno",
  },
  {
    status: 500,
  }
);

}
}