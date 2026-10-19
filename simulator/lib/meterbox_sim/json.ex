defmodule MeterboxSim.JSON do
  @moduledoc """
  Zero-dependency JSON codec that uses OTP 27's native `:json` module when available
  and falls back to a self-contained recursive Elixir parser/encoder.
  """

  def encode!(term) do
    if Code.ensure_loaded?(:json) and function_exported?(:json, :encode, 1) do
      :json.encode(term) |> IO.iodata_to_binary()
    else
      encode_value(term)
    end
  end

  def decode(binary) when is_binary(binary) do
    if Code.ensure_loaded?(:json) and function_exported?(:json, :decode, 1) do
      try do
        {:ok, :json.decode(binary)}
      rescue
        e -> {:error, e}
      end
    else
      try do
        {val, rest} = parse_value(String.trim(binary))

        if String.trim(rest) == "" do
          {:ok, val}
        else
          {:error, :trailing_bytes}
        end
      rescue
        e -> {:error, e}
      end
    end
  end

  def decode!(binary) do
    case decode(binary) do
      {:ok, val} -> val
      {:error, reason} -> raise "JSON decode error: #{inspect(reason)}"
    end
  end

  # ---------------------------------------------------------------------------
  # Pure-Elixir Fallback Encoder
  # ---------------------------------------------------------------------------
  defp encode_value(nil), do: "null"
  defp encode_value(true), do: "true"
  defp encode_value(false), do: "false"
  defp encode_value(n) when is_integer(n), do: Integer.to_string(n)
  defp encode_value(n) when is_float(n), do: :erlang.float_to_binary(n, [:compact, {:decimals, 6}])
  defp encode_value(a) when is_atom(a), do: encode_string(Atom.to_string(a))
  defp encode_value(s) when is_binary(s), do: encode_string(s)

  defp encode_value(list) when is_list(list) do
    "[" <> Enum.map_join(list, ",", &encode_value/1) <> "]"
  end

  defp encode_value(map) when is_map(map) do
    inner =
      map
      |> Enum.map(fn {k, v} ->
        key_str = if is_atom(k), do: Atom.to_string(k), else: to_string(k)
        encode_string(key_str) <> ":" <> encode_value(v)
      end)
      |> Enum.join(",")

    "{" <> inner <> "}"
  end

  defp encode_string(str) do
    escaped =
      str
      |> String.replace("\\", "\\\\")
      |> String.replace("\"", "\\\"")
      |> String.replace("\n", "\\n")
      |> String.replace("\r", "\\r")
      |> String.replace("\t", "\\t")

    "\"" <> escaped <> "\""
  end

  # ---------------------------------------------------------------------------
  # Pure-Elixir Fallback Decoder
  # ---------------------------------------------------------------------------
  defp parse_value(<<"\"", rest::binary>>), do: parse_string(rest, [])
  defp parse_value(<<"{", rest::binary>>), do: parse_object(String.trim_leading(rest), %{})
  defp parse_value(<<"[", rest::binary>>), do: parse_array(String.trim_leading(rest), [])
  defp parse_value(<<"true", rest::binary>>), do: {true, rest}
  defp parse_value(<<"false", rest::binary>>), do: {false, rest}
  defp parse_value(<<"null", rest::binary>>), do: {nil, rest}
  defp parse_value(bin), do: parse_number(bin)

  defp parse_string(<<"\\\"", rest::binary>>, acc), do: parse_string(rest, [?" | acc])
  defp parse_string(<<"\\\\", rest::binary>>, acc), do: parse_string(rest, [?\\ | acc])
  defp parse_string(<<"\\n", rest::binary>>, acc), do: parse_string(rest, [?\n | acc])
  defp parse_string(<<"\\r", rest::binary>>, acc), do: parse_string(rest, [?\r | acc])
  defp parse_string(<<"\\t", rest::binary>>, acc), do: parse_string(rest, [?\t | acc])
  defp parse_string(<<"\\/", rest::binary>>, acc), do: parse_string(rest, [?/ | acc])

  defp parse_string(<<"\"", rest::binary>>, acc) do
    {acc |> Enum.reverse() |> List.to_string(), rest}
  end

  defp parse_string(<<c::utf8, rest::binary>>, acc) do
    parse_string(rest, [c | acc])
  end

  defp parse_object(<<"}", rest::binary>>, acc), do: {acc, rest}

  defp parse_object(bin, acc) do
    {key, rest1} = parse_value(String.trim_leading(bin))
    <<":", rest2::binary>> = String.trim_leading(rest1)
    {val, rest3} = parse_value(String.trim_leading(rest2))
    rest4 = String.trim_leading(rest3)

    case rest4 do
      <<",", next::binary>> -> parse_object(String.trim_leading(next), Map.put(acc, key, val))
      <<"}", next::binary>> -> {Map.put(acc, key, val), next}
    end
  end

  defp parse_array(<<"]", rest::binary>>, acc), do: {Enum.reverse(acc), rest}

  defp parse_array(bin, acc) do
    {val, rest1} = parse_value(String.trim_leading(bin))
    rest2 = String.trim_leading(rest1)

    case rest2 do
      <<",", next::binary>> -> parse_array(String.trim_leading(next), [val | acc])
      <<"]", next::binary>> -> {Enum.reverse([val | acc]), next}
    end
  end

  defp parse_number(bin) do
    case Regex.run(~r/\A(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)(.*)\z/s, bin) do
      [_, num_str, rest] ->
        if String.contains?(num_str, [".", "e", "E"]) do
          {String.to_float(num_str), rest}
        else
          {String.to_integer(num_str), rest}
        end

      nil ->
        raise "Invalid JSON number near: #{String.slice(bin, 0, 20)}"
    end
  end
end
