export default function deepClone<T>( value: T ): T {
  return JSON.parse( JSON.stringify( value ) );
}