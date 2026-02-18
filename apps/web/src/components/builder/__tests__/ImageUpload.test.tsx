import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@solidjs/testing-library";
import { ImageUpload } from "../ImageUpload";
import type { Picture } from "../../../wasm/types";
import { createEmptyPicture } from "../../../wasm/types";

function createPicture(overrides?: Partial<Picture>): Picture {
  return { ...createEmptyPicture(), ...overrides };
}

describe("ImageUpload", () => {
  it("renders upload zone when no photo is set", () => {
    const onChange = vi.fn();
    render(() => <ImageUpload picture={createPicture()} onPictureChange={onChange} />);

    expect(screen.getByText("Profile Photo")).toBeInTheDocument();
    expect(screen.getByText("Click to upload or drag and drop")).toBeInTheDocument();
    expect(screen.getByText("JPG, PNG, or WebP (max 5 MB)")).toBeInTheDocument();
  });

  it("renders preview controls when photo is set", () => {
    const onChange = vi.fn();
    const picture = createPicture({
      url: "data:image/png;base64,iVBORw0KGgo=",
      effects: { hidden: false, border: false, grayscale: false },
    });
    render(() => <ImageUpload picture={picture} onPictureChange={onChange} />);

    // Should have Replace and Remove buttons
    expect(screen.getByText("Replace")).toBeInTheDocument();
    expect(screen.getByText("Remove")).toBeInTheDocument();

    // Should have effect toggles
    expect(screen.getByText("Hidden")).toBeInTheDocument();
    expect(screen.getByText("Grayscale")).toBeInTheDocument();
    expect(screen.getByText("Border")).toBeInTheDocument();

    // Should have sliders
    expect(screen.getByText("Size")).toBeInTheDocument();
    expect(screen.getByText("Border Radius")).toBeInTheDocument();

    // Should have an image element
    const imgs = document.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThan(0);
  });

  it("calls onPictureChange to clear URL when Remove is clicked", () => {
    const onChange = vi.fn();
    const picture = createPicture({
      url: "data:image/png;base64,iVBORw0KGgo=",
      effects: { hidden: false, border: false, grayscale: false },
    });
    render(() => <ImageUpload picture={picture} onPictureChange={onChange} />);

    fireEvent.click(screen.getByText("Remove"));

    expect(onChange).toHaveBeenCalledTimes(1);
    const updated = onChange.mock.calls[0][0] as Picture;
    expect(updated.url).toBe("");
    expect(updated.effects.hidden).toBe(true);
  });

  it("has a hidden file input with correct accept attribute", () => {
    const onChange = vi.fn();
    render(() => <ImageUpload picture={createPicture()} onPictureChange={onChange} />);

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    expect(fileInput).toBeTruthy();
    expect(fileInput.accept).toBe("image/jpeg,image/png,image/webp");
    expect(fileInput.classList.contains("hidden")).toBe(true);
  });

  it("updates border radius via slider", () => {
    const onChange = vi.fn();
    const picture = createPicture({
      url: "data:image/png;base64,iVBORw0KGgo=",
      size: 100,
      borderRadius: 10,
      effects: { hidden: false, border: false, grayscale: false },
    });
    render(() => <ImageUpload picture={picture} onPictureChange={onChange} />);

    const borderRadiusSlider = screen.getByRole("slider", { name: /border radius/i });
    fireEvent.input(borderRadiusSlider, { target: { value: "25" } });

    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as Picture;
    expect(updated.borderRadius).toBe(25);
  });

  it("updates size via slider", () => {
    const onChange = vi.fn();
    const picture = createPicture({
      url: "data:image/png;base64,iVBORw0KGgo=",
      size: 64,
      effects: { hidden: false, border: false, grayscale: false },
    });
    render(() => <ImageUpload picture={picture} onPictureChange={onChange} />);

    const sizeSlider = screen.getByRole("slider", { name: /size/i });
    fireEvent.input(sizeSlider, { target: { value: "120" } });

    expect(onChange).toHaveBeenCalled();
    const updated = onChange.mock.calls[0][0] as Picture;
    expect(updated.size).toBe(120);
  });
});
