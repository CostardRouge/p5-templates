export default function deepClone<T>( value: T ): T {
  try {
    return typeof structuredClone === "function"
      ? structuredClone( value )
      : JSON.parse( JSON.stringify( value ) );
  } catch {
    return JSON.parse( JSON.stringify( value ) );
  }
}
