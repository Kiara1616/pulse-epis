import { test, expect } from "@playwright/test";
import { compareCourses } from "../src/features/opportunities/comparison";
const free = { id: "free", skills: ["Python", "python", "IA"], cost_pen: 0 };
const paid = { id: "paid", skills: ["python", "datos"], cost_pen: 80 };
const unknown = { id: "unknown", skills: ["evaluación"], cost_pen: null };
test("comparación vacía no confirma costo ni presupuesto", () => {
  const result = compareCourses([], ["python"], "10", "100");
  expect(result.total).toBeNull();
  expect(result.budgetState).toBe("UNSET");
});
test("el escenario multiplica precio por personas y detecta temas compartidos", () => {
  const result = compareCourses(
    [free, paid],
    ["PYTHON", "datos", "redes"],
    "10",
    "700",
  );
  expect(result.total).toBe(800);
  expect(result.budgetState).toBe("OVER");
  expect(result.overlap).toEqual(["python"]);
  expect(result.missing).toEqual(["redes"]);
  expect(compareCourses([free], ["ia"], "5", "0").budgetState).toBe("WITHIN");
});
test("costo desconocido impide confirmar el total y presupuesto", () => {
  const result = compareCourses([paid, unknown], [], "10", "1000");
  expect(result.subtotal).toBe(800);
  expect(result.total).toBeNull();
  expect(result.budgetState).toBe("UNKNOWN");
});
test("cantidades y presupuestos inválidos no producen conclusiones", () => {
  for (const quantity of ["", "0", "-1", "1.5", "NaN", "10001"])
    expect(compareCourses([paid], [], quantity, "100").subtotal).toBeNull();
  for (const budget of ["", "-1", "NaN", "Infinity"])
    expect(compareCourses([paid], [], "5", budget).budgetState).toBe("UNSET");
});
