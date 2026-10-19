defmodule MeterboxSim.CustomerSupervisor do
  @moduledoc """
  `DynamicSupervisor` managing one `MeterboxSim.CustomerWorker` process per
  simulated tenant customer subject.
  """
  use DynamicSupervisor

  def start_link(init_arg) do
    DynamicSupervisor.start_link(__MODULE__, init_arg, name: __MODULE__)
  end

  def start_customer_worker(profile) do
    spec = {MeterboxSim.CustomerWorker, profile}
    DynamicSupervisor.start_child(__MODULE__, spec)
  end

  @impl true
  def init(_init_arg) do
    DynamicSupervisor.init(strategy: :one_for_one)
  end
end
