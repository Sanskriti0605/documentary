from decimal import Decimal, ROUND_HALF_UP
from typing import Dict, Any, List

TWO_PLACES = Decimal("0.01")

def round_money(val: Decimal) -> Decimal:
    return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)

def calculate_emi(
    principal: Decimal,
    annual_interest_rate_percent: Decimal,
    tenure_months: int
) -> Dict[str, Any]:
    """
    Compute Equated Monthly Installment (EMI) using Python Decimal.
    Formula: EMI = [P * r * (1 + r)^n] / [(1 + r)^n - 1]
    where r = annual_rate / (12 * 100)
    """
    if tenure_months <= 0:
        raise ValueError("Tenure months must be greater than zero.")
    if annual_interest_rate_percent < 0:
        raise ValueError("Interest rate cannot be negative.")

    if annual_interest_rate_percent == 0:
        emi = principal / Decimal(tenure_months)
        total_payment = principal
        total_interest = Decimal("0.00")
        steps = [
            f"Zero interest rate applied.",
            f"EMI = Principal / Months = {principal} / {tenure_months} = {round_money(emi)}"
        ]
    else:
        monthly_rate = (annual_interest_rate_percent / Decimal("100")) / Decimal("12")
        factor = (Decimal("1") + monthly_rate) ** tenure_months
        numerator = principal * monthly_rate * factor
        denominator = factor - Decimal("1")
        emi = numerator / denominator

        total_payment = emi * Decimal(tenure_months)
        total_interest = total_payment - principal

        steps = [
            f"Step 1: Convert annual rate ({annual_interest_rate_percent}%) to monthly rate r = {monthly_rate:.8f}",
            f"Step 2: Compute compounding factor (1 + r)^{tenure_months} = {factor:.8f}",
            f"Step 3: Multiply Principal ({principal}) * r * factor = {numerator:.8f}",
            f"Step 4: Divide by (factor - 1) = {denominator:.8f} => EMI = {round_money(emi)}",
            f"Step 5: Total Repayment = EMI * {tenure_months} = {round_money(total_payment)}, Total Interest = {round_money(total_interest)}"
        ]

    return {
        "principal": float(principal),
        "annual_interest_rate": float(annual_interest_rate_percent),
        "tenure_months": tenure_months,
        "monthly_emi": float(round_money(emi)),
        "total_repayment": float(round_money(total_payment)),
        "total_interest": float(round_money(total_interest)),
        "steps": steps
    }

def calculate_penal_charges(
    overdue_amount: Decimal,
    annual_penal_rate_percent: Decimal,
    days_overdue: int
) -> Dict[str, Any]:
    """
    Compute penal charges strictly per RBI Fair Lending Practice norms:
    Penalty = (Overdue Amount * Penal Rate % * Days Overdue) / (365 * 100)
    Penal charges are levied only on the overdue amount and cannot be capitalized.
    """
    if days_overdue < 0:
        raise ValueError("Days overdue cannot be negative.")

    penalty = (overdue_amount * (annual_penal_rate_percent / Decimal("100")) * Decimal(days_overdue)) / Decimal("365")
    gst = penalty * Decimal("0.18")  # 18% GST on fees/penal charges
    total = penalty + gst

    steps = [
        f"Step 1: Overdue Amount = INR {overdue_amount}",
        f"Step 2: Annual Penal Charge Rate = {annual_penal_rate_percent}% (per RBI Fair Practice Code, not capitalized)",
        f"Step 3: Days Overdue = {days_overdue} days",
        f"Step 4: Base Penal Charge = ({overdue_amount} * {annual_penal_rate_percent}% * {days_overdue}) / 365 = INR {round_money(penalty)}",
        f"Step 5: GST @ 18% = INR {round_money(gst)}",
        f"Step 6: Total Payable Penal Charges = INR {round_money(total)}"
    ]

    return {
        "overdue_amount": float(overdue_amount),
        "annual_penal_rate_percent": float(annual_penal_rate_percent),
        "days_overdue": days_overdue,
        "base_penal_charge": float(round_money(penalty)),
        "gst_18_percent": float(round_money(gst)),
        "total_penal_charge": float(round_money(total)),
        "steps": steps
    }

def calculate_processing_fee(
    loan_amount: Decimal,
    fee_percentage: Decimal,
    min_fee: Decimal = Decimal("1000.00"),
    max_fee: Decimal = Decimal("10000.00")
) -> Dict[str, Any]:
    """
    Calculate processing fees bounded by minimum and maximum fee thresholds + 18% GST.
    """
    calculated_raw = loan_amount * (fee_percentage / Decimal("100"))
    fee_capped = max(min_fee, min(max_fee, calculated_raw))
    gst = fee_capped * Decimal("0.18")
    total = fee_capped + gst

    steps = [
        f"Step 1: Raw Fee = {loan_amount} * {fee_percentage}% = INR {round_money(calculated_raw)}",
        f"Step 2: Apply bounds [Min: {min_fee}, Max: {max_fee}] => INR {round_money(fee_capped)}",
        f"Step 3: Applicable GST @ 18% = INR {round_money(gst)}",
        f"Step 4: Total Processing Fee = INR {round_money(total)}"
    ]

    return {
        "loan_amount": float(loan_amount),
        "fee_percentage": float(fee_percentage),
        "fee_before_gst": float(round_money(fee_capped)),
        "gst": float(round_money(gst)),
        "total_fee": float(round_money(total)),
        "steps": steps
    }
