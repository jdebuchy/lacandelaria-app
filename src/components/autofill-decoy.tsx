export function AutofillDecoy() {
  const hiddenStyle = {
    position: "absolute" as const,
    left: "-9999px",
    top: "0",
    width: "1px",
    height: "1px",
    opacity: 0,
    pointerEvents: "none" as const
  };

  return (
    <div aria-hidden="true" style={hiddenStyle}>
      <input tabIndex={-1} autoComplete="name" name="decoy_name" defaultValue="" />
      <input tabIndex={-1} autoComplete="street-address" name="decoy_street_address" defaultValue="" />
      <input tabIndex={-1} autoComplete="address-level2" name="decoy_city" defaultValue="" />
      <input tabIndex={-1} autoComplete="address-level1" name="decoy_state" defaultValue="" />
      <input tabIndex={-1} autoComplete="postal-code" name="decoy_postal_code" defaultValue="" />
    </div>
  );
}
