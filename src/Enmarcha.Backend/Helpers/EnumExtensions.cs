using System.ComponentModel;
using System.Reflection;
using Microsoft.AspNetCore.Mvc.Rendering;

namespace Enmarcha.Backend.Helpers;

public static class EnumExtensions
{
    public static string GetDescription(this Enum value)
    {
        var field = value.GetType().GetField(value.ToString());
        var attr = field?.GetCustomAttribute<DescriptionAttribute>();
        return attr?.Description ?? value.ToString();
    }

    public static IEnumerable<SelectListItem> ToSelectList<TEnum>() where TEnum : struct, Enum =>
        Enum.GetValues<TEnum>().Select(e => new SelectListItem
        {
            Value = e.ToString(),
            Text = e.GetDescription()
        });
}
